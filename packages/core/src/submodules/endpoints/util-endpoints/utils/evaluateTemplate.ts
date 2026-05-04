import { getAttr } from "../lib";
import type { EvaluateOptions } from "../types";

export const evaluateTemplate = (template: string, options: EvaluateOptions) => {
  const evaluatedTemplateArr: string[] = [];

  const { referenceRecord, endpointParams } = options;

  let currentIndex = 0;
  while (currentIndex < template.length) {
    const openingBraceIndex = template.indexOf("{", currentIndex);

    if (openingBraceIndex === -1) {
      // No more opening braces, add the rest of the template and break.
      evaluatedTemplateArr.push(template.slice(currentIndex));
      break;
    }

    evaluatedTemplateArr.push(template.slice(currentIndex, openingBraceIndex));
    const closingBraceIndex = template.indexOf("}", openingBraceIndex);

    if (closingBraceIndex === -1) {
      // No more closing braces, add the rest of the template and break.
      evaluatedTemplateArr.push(template.slice(openingBraceIndex));
      break;
    }

    if (template[openingBraceIndex + 1] === "{" && template[closingBraceIndex + 1] === "}") {
      // Escaped expression. Do not evaluate.
      evaluatedTemplateArr.push(template.slice(openingBraceIndex + 1, closingBraceIndex));
      currentIndex = closingBraceIndex + 2;
    }

    const parameterName = template.substring(openingBraceIndex + 1, closingBraceIndex);

    if (parameterName.includes("#")) {
      const [refName, attrName] = parameterName.split("#");
      evaluatedTemplateArr.push(
        getAttr((referenceRecord[refName] ?? endpointParams[refName]) as string, attrName) as string
      );
    } else {
      evaluatedTemplateArr.push((referenceRecord[parameterName] ?? endpointParams[parameterName]) as string);
    }

    currentIndex = closingBraceIndex + 1;
  }

  return evaluatedTemplateArr.join("");
};
