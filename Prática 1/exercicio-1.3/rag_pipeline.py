from __future__ import annotations

import argparse
import json
import re
import textwrap
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

import chromadb
from sentence_transformers import SentenceTransformer

try:
    from tqdm import tqdm
except ImportError:
    def tqdm(iterable, **kwargs):
        return iterable


DEFAULT_SYSTEM_PROMPT = textwrap.dedent(
    """
    Você é o Assistente de Atendimento da NovaTech.
    Responda exclusivamente com base nos trechos recuperados da documentação.

    Regras:
    1. Sempre cite a fonte usada na resposta.
    2. Nunca invente prazos, valores, SLAs ou regras.
    3. Se a informação não estiver no contexto, diga explicitamente que não encontrou.
    4. Em caso de conflito entre versões, sinalize o conflito.
    5. Responda em português formal e objetivo.
    """
).strip()

HEADING_PATTERN = re.compile(r"^(#{1,6})\s+(.*)$")
METADATA_PATTERN = re.compile(r"^\*\*(.+?)\*\*:\s*(.+)$")


@dataclass(slots=True)
class DocumentChunk:
    chunk_id: str
    document_name: str
    source_path: str
    section_path: str
    content: str
    version: str | None
    update_info: str | None

    def metadata(self) -> dict[str, str]:
        return {
            "document_name": self.document_name,
            "source_path": self.source_path,
            "section_path": self.section_path,
            "version": self.version or "",
            "update_info": self.update_info or "",
        }


def approx_tokens(text: str) -> int:
    # Regra prática: ~0.75 palavras por token. Cacheada para evitar recálculo.
    if not hasattr(approx_tokens, '_cache'):
        approx_tokens._cache = {}
    
    if text in approx_tokens._cache:
        return approx_tokens._cache[text]
    
    result = max(1, int(len(text.split()) / 0.75))
    approx_tokens._cache[text] = result
    return result


def parse_front_matter_metadata(lines: Sequence[str]) -> dict[str, str]:
    parsed: dict[str, str] = {}
    for line in lines[:15]:
        match = METADATA_PATTERN.match(line.strip())
        if match:
            parsed[match.group(1).strip().lower()] = match.group(2).strip()
    return parsed


def split_markdown_sections(text: str) -> list[tuple[list[str], list[str]]]:
    sections: list[tuple[list[str], list[str]]] = []
    heading_stack: list[str] = []
    current_lines: list[str] = []

    def flush() -> None:
        nonlocal current_lines
        cleaned = [line.rstrip() for line in current_lines]
        if any(line.strip() for line in cleaned):
            sections.append((heading_stack.copy(), cleaned))
        current_lines = []

    for line in text.splitlines():
        match = HEADING_PATTERN.match(line)
        if match:
            flush()
            level = len(match.group(1))
            title = match.group(2).strip()
            heading_stack[:] = heading_stack[: level - 1]
            heading_stack.append(title)
            continue
        current_lines.append(line)

    flush()
    return sections


def chunk_section(
    *,
    document_name: str,
    source_path: str,
    headings: list[str],
    section_lines: list[str],
    version: str | None,
    update_info: str | None,
    start_index: int,
    target_tokens: int,
    overlap_paragraphs: int,
) -> list[DocumentChunk]:
    paragraphs = [p.strip() for p in "\n".join(section_lines).split("\n\n") if p.strip()]
    if not paragraphs:
        return []

    chunks: list[DocumentChunk] = []
    buffer: list[str] = []
    index = start_index

    def append_chunk(content_parts: list[str]) -> None:
        nonlocal index
        chunks.append(
            DocumentChunk(
                chunk_id=f"{document_name}-{index:03d}",
                document_name=document_name,
                source_path=source_path,
                section_path=" > ".join(headings),
                content="\n\n".join(content_parts),
                version=version,
                update_info=update_info,
            )
        )
        index += 1

    for paragraph in paragraphs:
        if not buffer:
            buffer.append(paragraph)
            continue

        candidate = "\n\n".join(buffer + [paragraph])
        if approx_tokens(candidate) <= target_tokens:
            buffer.append(paragraph)
            continue

        append_chunk(buffer)

        overlap = buffer[-overlap_paragraphs:] if overlap_paragraphs else []
        overlap_candidate = "\n\n".join(overlap + [paragraph])
        buffer = overlap + [paragraph] if overlap and approx_tokens(overlap_candidate) <= target_tokens else [paragraph]

    if buffer:
        append_chunk(buffer)

    return chunks


def chunk_document(
    file_path: Path,
    *,
    target_tokens: int = 220,
    overlap_paragraphs: int = 1,
) -> list[DocumentChunk]:
    text = file_path.read_text(encoding="utf-8")
    metadata = parse_front_matter_metadata(text.splitlines())
    version = metadata.get("versão")
    update_info = metadata.get("última atualização") or metadata.get("data de emissão")

    sections = split_markdown_sections(text)
    chunks: list[DocumentChunk] = []
    chunk_index = 1

    for headings, lines in sections:
        if not headings:
            continue
        section_chunks = chunk_section(
            document_name=file_path.stem,
            source_path=str(file_path),
            headings=headings,
            section_lines=lines,
            version=version,
            update_info=update_info,
            start_index=chunk_index,
            target_tokens=target_tokens,
            overlap_paragraphs=overlap_paragraphs,
        )
        chunks.extend(section_chunks)
        chunk_index += len(section_chunks)

    return chunks


def build_embedding_text(chunk: DocumentChunk) -> str:
    parts = [
        f"Documento: {chunk.document_name}",
        f"Seção: {chunk.section_path}",
    ]
    if chunk.version:
        parts.append(f"Versão: {chunk.version}")
    if chunk.update_info:
        parts.append(f"Data/atualização: {chunk.update_info}")
    parts.append("Conteúdo:")
    parts.append(chunk.content)
    return "\n".join(parts)


class RAGPipeline:
    def __init__(
        self,
        *,
        persist_dir: Path,
        collection_name: str = "novatech_docs",
        embedding_model_name: str = "paraphrase-multilingual-MiniLM-L12-v2",
    ) -> None:
        self.persist_dir = persist_dir
        self.persist_dir.mkdir(parents=True, exist_ok=True)
        self.client = chromadb.PersistentClient(path=str(self.persist_dir))
        self.collection = self.client.get_or_create_collection(name=collection_name)
        self.embedding_model = SentenceTransformer(embedding_model_name)

    @staticmethod
    def is_source_document(file_path: Path) -> bool:
        return not file_path.name.lower().startswith("anexo-")

    def ingest(
        self,
        *,
        documents_dir: Path,
        target_tokens: int = 220,
        overlap_paragraphs: int = 1,
    ) -> dict[str, int]:
        files = [file_path for file_path in sorted(documents_dir.glob("*.md")) if self.is_source_document(file_path)]
        if not files:
            raise ValueError(f"Nenhum arquivo .md encontrado em {documents_dir}")

        print(f"📁 Lendo {len(files)} documento(s)...")
        all_chunks: list[DocumentChunk] = []
        for file_path in tqdm(files, desc="Chunking"):
            all_chunks.extend(
                chunk_document(
                    file_path,
                    target_tokens=target_tokens,
                    overlap_paragraphs=overlap_paragraphs,
                )
            )

        if not all_chunks:
            raise ValueError("Ingestão gerou 0 chunks. Verifique documentos de entrada.")

        print(f"🔤 Gerando embeddings para {len(all_chunks)} chunks...")
        documents = [build_embedding_text(c) for c in all_chunks]
        embeddings = self.embedding_model.encode(documents, show_progress_bar=True).tolist()
        ids = [c.chunk_id for c in all_chunks]
        metadatas = [c.metadata() for c in all_chunks]

        print("💾 Limpando banco anterior...")
        existing_ids = self.collection.get(include=[]).get("ids", [])
        if existing_ids:
            self.collection.delete(ids=existing_ids)

        print("📤 Armazenando chunks no ChromaDB...")
        self.collection.add(ids=ids, documents=documents, embeddings=embeddings, metadatas=metadatas)

        avg_tokens = int(sum(approx_tokens(d) for d in documents) / len(documents))
        return {
            "documents": len(files),
            "chunks": len(all_chunks),
            "avg_tokens_per_chunk": avg_tokens,
        }

    def search(self, question: str, *, top_k: int = 4) -> list[dict[str, object]]:
        if not question.strip():
            raise ValueError("Pergunta não pode estar vazia.")

        print(f"🔍 Buscando chunks para: {question}")
        expanded_question = self.expand_query(question)
        query_embedding = self.embedding_model.encode([expanded_question]).tolist()[0]
        collection_count = self.collection.count()
        if collection_count == 0:
            raise ValueError(
                "A coleção do ChromaDB está vazia. Execute primeiro: "
                "python .\\rag_pipeline.py ingest"
            )

        candidate_count = min(max(top_k * 8, 20), collection_count)
        result = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=candidate_count,
            include=["documents", "metadatas", "distances"],
        )

        matches: list[dict[str, object]] = []
        ids = result.get("ids", [[]])[0]
        docs = result.get("documents", [[]])[0]
        metas = result.get("metadatas", [[]])[0]
        distances = result.get("distances", [[]])[0]

        for chunk_id, doc, meta, distance in zip(ids, docs, metas, distances):
            similarity = 1 / (1 + float(distance))
            matches.append(
                {
                    "id": chunk_id,
                    "score": round(similarity, 4),
                    "distance": round(float(distance), 4),
                    "metadata": meta,
                    "content": doc,
                }
            )

        reranked = self.rerank(question, matches)
        print(f"✅ Recuperados {min(len(reranked), top_k)} chunk(s)")
        return reranked[:top_k]

    @staticmethod
    def expand_query(question: str) -> str:
        normalized = RAGPipeline.normalize_text(question)
        expansions: list[str] = []

        if "devolver" in normalized or "devolucao" in normalized:
            expansions.append("devolução prazo geral exceções não elegíveis processo padrão portal cliente")
        if "carga perigosa" in normalized or "cargas perigosas" in normalized:
            expansions.append("cargas perigosas classes ANTT Gestão de Riscos ramal 4500")
        if "sla" in normalized or "gold" in normalized or "silver" in normalized or "standard" in normalized:
            expansions.append("SLA chamados gerais resposta resolução Gold Silver Standard tabela")
        if "frete" in normalized or "multiplicador" in normalized or "manaus" in normalized:
            expansions.append("frete especial multiplicador regional região Norte Sudeste fórmula valor base")

        return " ".join([question, *expansions])

    @staticmethod
    def normalize_text(text: str) -> str:
        normalized = unicodedata.normalize("NFKD", text.lower())
        return "".join(char for char in normalized if not unicodedata.combining(char))

    @staticmethod
    def normalized_terms(text: str) -> set[str]:
        terms = set()
        for term in re.findall(r"\w+", RAGPipeline.normalize_text(text)):
            terms.add(term)
            if len(term) > 4 and term.endswith("s"):
                terms.add(term[:-1])
        return terms

    @staticmethod
    def rerank(question: str, matches: list[dict[str, object]]) -> list[dict[str, object]]:
        query_terms = RAGPipeline.normalized_terms(RAGPipeline.expand_query(question))

        def ranking_score(match: dict[str, object]) -> float:
            metadata = match.get("metadata", {})
            document_name = str(metadata.get("document_name", "")) if isinstance(metadata, dict) else ""
            content = str(match.get("content", ""))
            content_terms = RAGPipeline.normalized_terms(content)
            lexical_overlap = len(query_terms & content_terms) / max(1, len(query_terms))
            semantic_score = float(match.get("score", 0.0))
            formal_boost = 0.08 if document_name.startswith(("POL-", "PROC-", "SLA-")) else 0.0
            return semantic_score + (0.65 * lexical_overlap) + formal_boost

        return sorted(matches, key=ranking_score, reverse=True)

    def build_prompt(
        self,
        *,
        question: str,
        chunks: Sequence[dict[str, object]],
        system_prompt: str = DEFAULT_SYSTEM_PROMPT,
    ) -> str:
        context_blocks: list[str] = []
        for i, item in enumerate(chunks, start=1):
            meta = item.get("metadata", {})
            context_blocks.append(
                textwrap.dedent(
                    f"""
                    [Chunk {i}]
                    Fonte: {meta.get('document_name')} | Seção: {meta.get('section_path')} | Score: {item.get('score')}
                    {item.get('content')}
                    """
                ).strip()
            )

        context = "\n\n".join(context_blocks) if context_blocks else "Nenhum chunk recuperado."

        prompt = textwrap.dedent(
            f"""
            ## SYSTEM PROMPT
            {system_prompt}

            ## CONTEXTO RECUPERADO
            {context}

            ## PERGUNTA DO ATENDENTE
            {question}
            """
        ).strip()
        
        print(f"📋 Prompt montado com {len(chunks)} chunk(s) ({sum(len(b.split()) for b in context_blocks)} palavras)")
        return prompt


def default_documents_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "documentos"


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Pipeline RAG mínimo da NovaTech")
    p.add_argument("--persist-dir", default=str(Path(__file__).resolve().parent / "chroma_db"))
    p.add_argument("--documents-dir", default=str(default_documents_dir()))

    sub = p.add_subparsers(dest="command", required=True)

    ingest = sub.add_parser("ingest", help="Lê docs, cria chunks, gera embeddings e armazena no ChromaDB")
    ingest.add_argument("--target-tokens", type=int, default=220)
    ingest.add_argument("--overlap-paragraphs", type=int, default=1)

    search = sub.add_parser("search", help="Busca os chunks mais similares para uma pergunta")
    search.add_argument("question")
    search.add_argument("--top-k", type=int, default=4)

    prompt = sub.add_parser("prompt", help="Monta prompt final com sistema + contexto + pergunta")
    prompt.add_argument("question")
    prompt.add_argument("--top-k", type=int, default=4)

    return p


def print_json(data: dict[str, object] | list[dict[str, object]]) -> None:
    print(json.dumps(data, ensure_ascii=False, indent=2))


def main() -> None:
    args = parser().parse_args()
    pipeline = RAGPipeline(persist_dir=Path(args.persist_dir))

    if args.command == "ingest":
        summary = pipeline.ingest(
            documents_dir=Path(args.documents_dir),
            target_tokens=args.target_tokens,
            overlap_paragraphs=args.overlap_paragraphs,
        )
        print_json(summary)
        return

    if args.command == "search":
        print_json(pipeline.search(args.question, top_k=args.top_k))
        return

    if args.command == "prompt":
        chunks = pipeline.search(args.question, top_k=args.top_k)
        print(pipeline.build_prompt(question=args.question, chunks=chunks))
        return


if __name__ == "__main__":
    main()
