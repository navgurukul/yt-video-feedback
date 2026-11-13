const LEVELS = ["Beginner (1)", "Intermediate (2)", "Advanced (3)", "Expert (4)"];
const clean = (value) => String(value ?? "").replace(/\u00a0|\u202f/g, " ").replace(/\s+/g, " ").trim();
const decode = (value) => {
  const node = document.createElement("textarea");
  node.innerHTML = value;
  return clean(node.value);
};
const cell = (value) => decode(String(value ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "));

function contextFromText(text) {
  const source = clean(text);
  const assignment = source.match(/(?:assignment\s*(?:no\.?|number|title|name)?|task)\s*[:#-]?\s*(.+?)(?=\s+(?:rubrics?|rubric\s*type)\s*[:\-]|$)/i);
  const rubric = source.match(/(?:rubrics?|rubric\s*type)\s*:\s*([^|\n]+)/i);
  return {
    assignmentTitle: clean(assignment?.[1] || source.match(/assignment\s+\d+\s*[:#-]?\s*(.+)/i)?.[1]),
    name: clean(rubric?.[1]),
  };
}

function headerIndex(headers, pattern) {
  return headers.findIndex((header) => pattern.test(clean(header).toLowerCase()));
}

function mapCells(rows, context) {
  if (rows.length < 2) throw new Error("The rubric table has no data rows.");
  const headers = rows[0].map(cell);
  const parameterIndex = headerIndex(headers, /evaluation\s*(parameter|criteria)|criterion|parameter/);
  const weightIndex = headerIndex(headers, /weight/);
  const levelIndexes = LEVELS.map((level) => headerIndex(headers, new RegExp(level.split(" ")[0].toLowerCase())));
  if (parameterIndex < 0 || weightIndex < 0 || levelIndexes.some((index) => index < 0)) {
    throw new Error("The table must include Evaluation Parameter, Weightage (%), Beginner, Intermediate, Advanced, and Expert columns.");
  }
  const checklistIndex = headerIndex(headers, /checklist/);
  const criteria = rows.slice(1).map((row, rowIndex) => {
    const values = row.map(cell);
    if (!values.some(Boolean)) return null;
    const parameter = values[parameterIndex];
    const weight = Number.parseFloat(values[weightIndex]?.replace("%", ""));
    if (!parameter) throw new Error(`Criterion row ${rowIndex + 1} is missing an evaluation parameter.`);
    if (!Number.isFinite(weight)) throw new Error(`Criterion "${parameter}" has an invalid weightage.`);
    const result = { Parameter: parameter, "Weightage (%)": weight };
    LEVELS.forEach((level, index) => {
      result[level] = values[levelIndexes[index]] || "";
    });
    result.Checklist = checklistIndex >= 0 ? values[checklistIndex].split(/\s*(?:\n|•)\s*/).filter(Boolean) : [];
    return result;
  }).filter(Boolean);
  if (!criteria.length) throw new Error("The rubric table has no evaluation criteria.");
  return {
    assignmentTitle: clean(context.assignmentTitle),
    name: clean(context.name) || clean(context.assignmentTitle) || "Pasted YT rubric",
    rubricType: "project",
    levels: [...LEVELS],
    criteria,
  };
}

function htmlTables(source, context) {
  const doc = new DOMParser().parseFromString(source, "text/html");
  const table = doc.querySelector("table");
  if (!table) return null;
  const parsedContext = contextFromText(doc.body.textContent || "");
  const rows = [...table.rows].map((row) => [...row.cells].map((item) => item.innerHTML));
  return mapCells(rows, { ...context, ...parsedContext });
}

function markdownTable(source, context) {
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const tableStart = lines.findIndex((line) => /evaluation\s*(parameter|criteria)/i.test(line) && /weight/i.test(line));
  if (tableStart < 0) return null;
  const tableLines = lines.slice(tableStart).filter((line) => line.includes("|"));
  const rows = tableLines
    .filter((line) => !/^\s*\|?\s*:?-+\s*(\|\s*:?-+\s*)+\|?\s*$/.test(line))
    .map((line) => line.replace(/^\s*\||\|\s*$/g, "").split(/(?<!\\)\|/).map((part) => part.replace(/\\\|/g, "|")));
  return mapCells(rows, context);
}

function verticalTable(source, context) {
  const lines = source.split(/\r?\n/).map(clean).filter(Boolean);
  const header = lines.findIndex((line, index) =>
    /evaluation\s*(parameter|criteria)/i.test(line)
    && /weightage|weight/i.test(lines[index + 1] || ""));
  if (header < 0) return null;

  const criterionStarts = [];
  for (let index = header + 2; index < lines.length; index += 1) {
    if (/^\d+\.\s+\S/.test(lines[index])) criterionStarts.push(index);
  }
  if (!criterionStarts.length) return null;

  const rows = criterionStarts.map((start, index) => {
    const end = criterionStarts[index + 1] || lines.length;
    const block = lines.slice(start, end);
    const parameter = block.shift().replace(/^\d+\.\s*/, "").trim();
    const weight = block.shift();
    const descriptions = block.filter((line) => !/^(?:beginner|intermediate|advanced|expert)$/i.test(line));
    if (descriptions.length < 4) {
      throw new Error(`Criterion "${parameter}" is missing one or more performance-level descriptions.`);
    }
    return [parameter, weight, ...descriptions.slice(0, 4)];
  });

  return mapCells([
    ["Evaluation Parameter", "Weightage (%)", ...LEVELS],
    ...rows,
  ], context);
}

function plainTable(source, context) {
  const lines = source.split(/\r?\n/).map(clean).filter(Boolean);
  const start = lines.findIndex((line) => /evaluation\s*(parameter|criteria)/i.test(line) && /weight/i.test(line));
  if (start < 0) throw new Error("No rubric table was found. Include the required evaluation columns.");
  const rows = lines.slice(start + 1).map((line) => {
    const match = line.match(/^(.*?)\s+(\d+(?:\.\d+)?)%\s+(.+)$/);
    if (!match) return null;
    const descriptions = match[3].split(/\s{2,}|\t/).map(clean).filter(Boolean);
    return [match[1], `${match[2]}%`, ...descriptions];
  }).filter(Boolean);
  return mapCells([
    ["Evaluation Parameter", "Weightage (%)", ...LEVELS],
    ...rows,
  ], context);
}

export function parseYtRubricText(input) {
  const source = String(input ?? "").trim();
  if (!source) throw new Error("Paste rubric content before generating.");
  const context = contextFromText(source);
  // Copied table selections often omit the document heading and rubric-type line.
  // Keep the table usable and let the admin supply those fields in the editor.
  const parsedContext = {
    ...context,
    assignmentTitle: context.assignmentTitle || "Pasted YT assignment",
    name: context.name || "Pasted YT rubric",
  };
  const parsed = htmlTables(source, parsedContext)
    || markdownTable(source, parsedContext)
    || verticalTable(source, parsedContext)
    || plainTable(source, parsedContext);
  if (!parsed) throw new Error("No rubric table was found.");
  return parsed;
}
