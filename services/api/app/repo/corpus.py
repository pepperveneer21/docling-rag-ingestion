"""B2 storage operations scoped to the sample's `corpus/` prefix.

All access is through the S3-compatible API via the shared boto3 client owned by
`b2_client`. This module is the ONLY writer/reader of corpus objects — one folder
per document holds the raw source and every derived artifact side-by-side:

    corpus/<doc-id>/source.<ext>     raw upload (immutable)
    corpus/<doc-id>/parsed.<ext>     Docling export (Markdown by default)
    corpus/<doc-id>/chunks.jsonl     one JSON chunk record per line
    corpus/<doc-id>/manifest.json    status + config + result (source of truth)

Deletes and lists are scoped to `corpus/` so shared-bucket data is never touched.
"""

import io

from botocore.exceptions import BotoCoreError, ClientError

from app.config import settings
from app.repo.b2_client import get_s3_client
from app.repo.b2_object import get_object_bytes

CORPUS_PREFIX = "corpus/"
MANIFEST_NAME = "manifest.json"


def document_prefix(doc_id: str) -> str:
    return f"{CORPUS_PREFIX}{doc_id}/"


def manifest_key(doc_id: str) -> str:
    return f"{document_prefix(doc_id)}{MANIFEST_NAME}"


def put_object_bytes(key: str, body: bytes, content_type: str) -> int:
    """Write bytes to B2 under `key`. Returns the byte length. Raises RuntimeError."""
    client = get_s3_client()
    try:
        client.put_object(
            Bucket=settings.b2_bucket_name,
            Key=key,
            Body=io.BytesIO(body),
            ContentType=content_type,
        )
    except (ClientError, BotoCoreError) as e:
        raise RuntimeError(f"B2 put failed for '{key}': {e}") from e
    return len(body)


def get_object_text(key: str) -> str:
    """Read an object's UTF-8 text body. Raises RuntimeError on S3 failure."""
    return get_object_bytes(key).decode("utf-8", errors="replace")


def object_exists(key: str) -> bool:
    client = get_s3_client()
    try:
        client.head_object(Bucket=settings.b2_bucket_name, Key=key)
        return True
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey", "NotFound"):
            return False
        raise RuntimeError(f"B2 head failed for '{key}': {e}") from e


def list_manifest_keys() -> list[str]:
    """Every `corpus/*/manifest.json` key. Raises RuntimeError on S3 failure."""
    client = get_s3_client()
    keys: list[str] = []
    kwargs: dict = {
        "Bucket": settings.b2_bucket_name,
        "Prefix": CORPUS_PREFIX,
        "MaxKeys": 1000,
    }
    try:
        while True:
            response = client.list_objects_v2(**kwargs)
            for obj in response.get("Contents", []):
                if obj["Key"].endswith(f"/{MANIFEST_NAME}"):
                    keys.append(obj["Key"])
            if not response.get("IsTruncated"):
                break
            kwargs["ContinuationToken"] = response["NextContinuationToken"]
    except (ClientError, BotoCoreError) as e:
        raise RuntimeError(f"B2 list failed for corpus: {e}") from e
    return keys


def delete_document_objects(doc_id: str) -> int:
    """Delete every object under `corpus/<doc-id>/`. Returns the count deleted.

    Scoped to the document's own prefix so a delete can never reach outside the
    corpus. Raises RuntimeError on S3 failure.
    """
    client = get_s3_client()
    prefix = document_prefix(doc_id)
    deleted = 0
    kwargs: dict = {
        "Bucket": settings.b2_bucket_name,
        "Prefix": prefix,
        "MaxKeys": 1000,
    }
    try:
        while True:
            response = client.list_objects_v2(**kwargs)
            for obj in response.get("Contents", []):
                client.delete_object(Bucket=settings.b2_bucket_name, Key=obj["Key"])
                deleted += 1
            if not response.get("IsTruncated"):
                break
            kwargs["ContinuationToken"] = response["NextContinuationToken"]
    except (ClientError, BotoCoreError) as e:
        raise RuntimeError(f"B2 delete failed for corpus/{doc_id}: {e}") from e
    return deleted
