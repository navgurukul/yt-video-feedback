import { cn } from "@/lib/utils";

interface RubricComparisonTableProps {
  kind: "concept" | "project";
  rubric: any[];
}

const formatHeadingText = (value: unknown) => {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
};

const extractCoreText = (value: unknown) => {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text) return "";

  return text
    .replace(/(?:\(e\.g\.|Sample prompts?:|Examples?:)[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
};

const renderRichText = (value: unknown) => {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();
  if (!text) return null;

  const bulletItems = text
    .split("•")
    .map((item) => item.trim())
    .filter(Boolean);

  if (bulletItems.length > 1) {
    return (
      <ul className="space-y-2 pl-5 text-sm leading-6 text-foreground">
        {bulletItems.map((item, index) => (
          <li key={`${index}-${item.slice(0, 20)}`} className="list-disc">
            {item}
          </li>
        ))}
      </ul>
    );
  }

  const paragraphs = text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (paragraphs.length > 1) {
    return (
      <div className="space-y-3 text-sm leading-6 text-foreground">
        {paragraphs.map((paragraph, index) => (
          <p key={`${index}-${paragraph.slice(0, 20)}`}>{paragraph}</p>
        ))}
      </div>
    );
  }

  return <p className="text-sm leading-6 text-foreground">{text}</p>;
};

const cleanDescription = (value: unknown) => {
  const text = extractCoreText(value);
  return text || String(value ?? "").trim();
};

const RubricComparisonTable = ({ kind, rubric }: RubricComparisonTableProps) => {
  if (kind === "concept") {
    return (
      <div className="overflow-hidden border border-foreground bg-card">
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full border-collapse">
            <thead>
              <tr className="bg-muted/40 text-left">
                <th className="border-b border-foreground px-4 py-3 text-sm font-semibold text-foreground">Level</th>
                <th className="border-b border-foreground px-4 py-3 text-sm font-semibold text-foreground">What the student should show</th>
              </tr>
            </thead>
            <tbody>
              {rubric.map((item, index) => {
                const level = item.Level ?? `Level ${index + 1}`;
                const descriptionKey = Object.keys(item).find((key) => key !== "Level") || "";
                const description = item[descriptionKey];

                return (
                  <tr key={`${level}-${index}`} className="align-top odd:bg-card even:bg-muted/10">
                    <td className="border-b border-foreground px-4 py-4 align-top text-sm font-semibold text-foreground">
                      {level}
                    </td>
                    <td className="border-b border-foreground px-4 py-4 text-sm leading-7 text-foreground/90">
                      {renderRichText(cleanDescription(description))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {rubric.map((item, index) => {
        const levelCells = [
          { label: "Beginner (1)", value: item["Beginner (1)"] },
          { label: "Intermediate (2)", value: item["Intermediate (2)"] },
          { label: "Advanced (3)", value: item["Advanced (3)"] },
          { label: "Expert (4)", value: item["Expert (4)"] },
        ];

        return (
          <section key={`${formatHeadingText(item.Parameter)}-${index}`} className="overflow-hidden border border-foreground bg-card">
            <header className="border-b border-foreground px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Parameter</p>
                  <h3 className="text-base font-semibold leading-6 text-foreground">{formatHeadingText(item.Parameter)}</h3>
                </div>
              </div>
            </header>

            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full border-collapse">
                <thead>
                  <tr className="bg-muted/40 text-left">
                    {levelCells.map((cell, cellIndex) => (
                      <th
                        key={cell.label}
                        className={cn(
                          "border-b border-foreground px-4 py-3 text-sm font-semibold text-foreground",
                          cellIndex < levelCells.length - 1 && "border-r border-foreground",
                        )}
                      >
                        {cell.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="align-top">
                    {levelCells.map((cell, cellIndex) => (
                      <td
                        key={cell.label}
                        className={cn(
                          "border-b border-foreground px-4 py-4 align-top text-sm leading-7 text-foreground/90",
                          cellIndex < levelCells.length - 1 && "border-r border-foreground",
                        )}
                      >
                        {renderRichText(cleanDescription(cell.value))}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
};

export { RubricComparisonTable };