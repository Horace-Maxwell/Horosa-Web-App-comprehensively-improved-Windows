import argparse
import json
from pathlib import Path


def parse_version_tuple(raw_version: str) -> tuple[int, int, int, int]:
    parts: list[int] = []
    for token in str(raw_version).split("."):
        token = token.strip()
        if not token:
            continue
        try:
            parts.append(int(token))
        except ValueError as exc:
            raise ValueError(f"Unsupported version segment: {token!r}") from exc
    if not parts:
        raise ValueError("Version string is empty.")
    while len(parts) < 4:
        parts.append(0)
    return tuple(parts[:4])


def build_version_info_text(
    *,
    numeric_version: tuple[int, int, int, int],
    version_string: str,
    product_version_string: str,
    company_name: str,
    product_name: str,
    file_description: str,
    internal_name: str,
    original_filename: str,
) -> str:
    return f"""# UTF-8
VSVersionInfo(
  ffi=FixedFileInfo(
    filevers={numeric_version},
    prodvers={numeric_version},
    mask=0x3F,
    flags=0x0,
    OS=0x40004,
    fileType=0x1,
    subtype=0x0,
    date=(0, 0)
  ),
  kids=[
    StringFileInfo(
      [
        StringTable(
          '040904B0',
          [
            StringStruct('CompanyName', {company_name!r}),
            StringStruct('FileDescription', {file_description!r}),
            StringStruct('FileVersion', {version_string!r}),
            StringStruct('InternalName', {internal_name!r}),
            StringStruct('OriginalFilename', {original_filename!r}),
            StringStruct('ProductName', {product_name!r}),
            StringStruct('ProductVersion', {product_version_string!r}),
          ]
        )
      ]
    ),
    VarFileInfo([VarStruct('Translation', [1033, 1200])])
  ]
)
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--version-json", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--file-description", required=True)
    parser.add_argument("--internal-name", required=True)
    parser.add_argument("--original-filename", required=True)
    parser.add_argument("--company-name", default="Horosa")
    parser.add_argument("--product-name", default="Xingque Desktop")
    args = parser.parse_args()

    version_json_path = Path(args.version_json).resolve()
    output_path = Path(args.output).resolve()
    version_info = json.loads(version_json_path.read_text(encoding="utf-8"))

    version_string = str(version_info["version"])
    release_name = str(version_info.get("release_name") or version_string)
    numeric_version = parse_version_tuple(version_string)
    product_version_string = f"{release_name} ({version_string})"

    text = build_version_info_text(
        numeric_version=numeric_version,
        version_string=version_string,
        product_version_string=product_version_string,
        company_name=str(args.company_name),
        product_name=str(args.product_name),
        file_description=str(args.file_description),
        internal_name=str(args.internal_name),
        original_filename=str(args.original_filename),
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(text, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
