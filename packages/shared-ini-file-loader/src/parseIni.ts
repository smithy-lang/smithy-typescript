import { ParsedIniData } from "@smithy/types";

const profileNameBlockList = ["__proto__", "profile __proto__"];

export const parseIni = (iniData: string): ParsedIniData => {
  const map: ParsedIniData = {};

  let currentSectionName: string | undefined;
  let currentSubSectionName: string | undefined;

  for (let line of iniData.split(/\r?\n/)) {
    line = line.split(/(^|\s)[;#]/)[0].trim(); // remove comments and trim
    const isSection: boolean = line[0] === "[" && line[line.length - 1] === "]";
    if (isSection) {
      currentSectionName = line.substring(1, line.length - 1);
      currentSubSectionName = undefined;
      if (profileNameBlockList.includes(currentSectionName)) {
        throw new Error(`Found invalid profile name "${currentSectionName}"`);
      }
    } else if (currentSectionName) {
      const indexOfEqualsSign = line.indexOf("=");
      if (![0, -1].includes(indexOfEqualsSign)) {
        const [name, value]: [string, string] = [
          line.substring(0, indexOfEqualsSign).trim(),
          line.substring(indexOfEqualsSign + 1).trim(),
        ];
        if (value === "") {
          currentSubSectionName = name;
        } else {
          if (map[currentSectionName] === undefined) {
            map[currentSectionName] = {};
          }
          const currentSection = map[currentSectionName];
          if (currentSubSectionName === undefined) {
            currentSection[name] = value;
          } else {
            if (currentSection[currentSubSectionName] === undefined) {
              currentSection[currentSubSectionName] = {};
            }
            const currentSubSection = currentSection[currentSubSectionName];
            if (typeof currentSubSection !== "string") {
              currentSubSection[name] = value;
            }
          }
        }
      }
    }
  }

  return map;
};
