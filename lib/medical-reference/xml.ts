/**
 * A minimal, dependency-free XML parser.
 *
 * The MedlinePlus Web Service and PubMed EFetch (abstract) both return XML.
 * Node's server runtime has no DOM, and we don't want a new dependency for
 * three small parsing jobs, so this parses just enough of XML — elements,
 * attributes, text, CDATA, comments, processing instructions and the XML
 * declaration — to extract the fields we need. It is not a full XML
 * implementation and is only used for known, trusted upstream payloads.
 */

export interface XmlNode {
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  /** Concatenated own text + CDATA content (excluding child elements). */
  text: string;
}

function decodeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_m, dec: string) =>
      String.fromCodePoint(Number(dec)),
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Parse an XML string into a tree, or null when no element is found. */
export function parseXml(xml: string): XmlNode | null {
  let i = 0;
  const n = xml.length;

  function skipWs(): void {
    while (i < n && /\s/.test(xml.charAt(i))) i += 1;
  }

  function parseName(): string {
    const start = i;
    while (i < n && /[A-Za-z0-9_.:-]/.test(xml.charAt(i))) i += 1;
    return xml.slice(start, i);
  }

  function parseAttributes(): Record<string, string> {
    const attrs: Record<string, string> = {};
    for (;;) {
      skipWs();
      const ch = xml.charAt(i);
      if (ch === "" || ch === ">" || ch === "/" || ch === "?") break;
      const name = parseName();
      if (!name) break;
      skipWs();
      if (xml.charAt(i) === "=") {
        i += 1;
        skipWs();
        const quote = xml.charAt(i);
        if (quote === '"' || quote === "'") {
          i += 1;
          let value = "";
          while (i < n && xml.charAt(i) !== quote) {
            value += xml.charAt(i);
            i += 1;
          }
          i += 1;
          attrs[name] = decodeXml(value);
        }
      } else {
        attrs[name] = "";
      }
    }
    return attrs;
  }

  function parseElement(): XmlNode | null {
    if (xml.charAt(i) !== "<") return null;
    i += 1;
    const name = parseName();
    if (!name) return null;
    const attributes = parseAttributes();
    skipWs();

    const node: XmlNode = { name, attributes, children: [], text: "" };

    if (xml.charAt(i) === "/") {
      i += 1;
      if (xml.charAt(i) === ">") i += 1;
      return node;
    }
    if (xml.charAt(i) === "?") {
      while (i < n && !(xml.charAt(i) === "?" && xml.charAt(i + 1) === ">")) {
        i += 1;
      }
      i += 2;
      return node;
    }
    if (xml.charAt(i) !== ">") return node;
    i += 1;

    for (;;) {
      if (i >= n) break;
      if (xml.charAt(i) === "<") {
        if (xml.startsWith("</", i)) {
          i += 2;
          parseName();
          skipWs();
          if (xml.charAt(i) === ">") i += 1;
          break;
        }
        if (xml.startsWith("<!--", i)) {
          const end = xml.indexOf("-->", i);
          i = end === -1 ? n : end + 3;
          continue;
        }
        if (xml.startsWith("<![CDATA[", i)) {
          const start = i + 9;
          const end = xml.indexOf("]]>", start);
          node.text += end === -1 ? xml.slice(start) : xml.slice(start, end);
          i = end === -1 ? n : end + 3;
          continue;
        }
        if (xml.startsWith("<?", i)) {
          const end = xml.indexOf("?>", i);
          i = end === -1 ? n : end + 2;
          continue;
        }
        const child = parseElement();
        if (child) node.children.push(child);
        else break;
        continue;
      }
      const start = i;
      const nextLt = xml.indexOf("<", i);
      i = nextLt === -1 ? n : nextLt;
      node.text += decodeXml(xml.slice(start, i));
    }
    return node;
  }

  while (i < n) {
    const ch = xml.charAt(i);
    if (ch === "<") {
      if (xml.startsWith("<?", i)) {
        const end = xml.indexOf("?>", i);
        i = end === -1 ? n : end + 2;
        continue;
      }
      if (xml.startsWith("<!--", i)) {
        const end = xml.indexOf("-->", i);
        i = end === -1 ? n : end + 3;
        continue;
      }
      if (xml.startsWith("<!DOCTYPE", i) || xml.startsWith("<!doctype", i)) {
        const end = xml.indexOf(">", i);
        i = end === -1 ? n : end + 1;
        continue;
      }
      return parseElement();
    }
    i += 1;
  }
  return null;
}

/** Direct children with the given tag name. */
export function childrenNamed(node: XmlNode | null, name: string): XmlNode[] {
  return node ? node.children.filter((child) => child.name === name) : [];
}

/** Text of the first direct child with the given tag name. */
export function childText(node: XmlNode | null, name: string): string | null {
  const child = childrenNamed(node, name)[0];
  return child ? child.text : null;
}

/** All descendant nodes with the given tag name (recursive). */
export function findAll(node: XmlNode | null, name: string): XmlNode[] {
  if (!node) return [];
  const out: XmlNode[] = [];
  const visit = (current: XmlNode): void => {
    for (const child of current.children) {
      if (child.name === name) out.push(child);
      visit(child);
    }
  };
  visit(node);
  return out;
}
