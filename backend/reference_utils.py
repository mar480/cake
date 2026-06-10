def derive_reference_source(ref: dict) -> str:
    source_name = str(ref.get("name") or "").strip()
    source_number = str(ref.get("number") or "").strip()
    source = f"{source_name} {source_number}".strip()
    if source:
        return source

    return str(
        ref.get("reference_role")
        or ref.get("reference_role_uri")
        or ref.get("role")
        or ""
    ).strip()


def build_reference_display(ref: dict) -> str | None:
    source = derive_reference_source(ref)
    paragraph = str(ref.get("paragraph") or "").strip()

    if source and paragraph:
        return f"{source}, {paragraph}"
    if source:
        return source
    return None
