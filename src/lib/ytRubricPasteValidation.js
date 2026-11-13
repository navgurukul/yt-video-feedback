const LEVELS = ["Beginner (1)", "Intermediate (2)", "Advanced (3)", "Expert (4)"];

export function validateYtRubricPaste(rubric) {
  const errors = [];
  const criteria = rubric.criteria || [];
  if (!rubric.name?.trim()) errors.push("Rubric title is required.");
  if (!rubric.assignmentTitle?.trim()) errors.push("Assignment details are required.");
  if (!criteria.length) errors.push("Add at least one evaluation criterion.");
  const names = new Set();
  let total = 0;
  criteria.forEach((criterion, index) => {
    const label = `Criterion ${index + 1}`;
    const name = String(criterion.Parameter || "").trim();
    if (!name) errors.push(`${label}: name is required.`);
    if (names.has(name.toLowerCase())) errors.push(`${label}: duplicate criterion "${name}".`);
    names.add(name.toLowerCase());
    const weight = Number(criterion["Weightage (%)"]);
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) errors.push(`${label}: weightage must be between 0 and 100.`);
    else total += weight;
    LEVELS.forEach((level) => {
      if (!String(criterion[level] || "").trim()) errors.push(`${label}: ${level} description is required.`);
    });
  });
  if (criteria.length && total !== 100) errors.push(`Weightage total is ${total}%, not 100%.`);
  return { errors, total };
}
