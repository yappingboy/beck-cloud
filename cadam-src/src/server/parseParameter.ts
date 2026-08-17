import {
  Parameter,
  ParameterOption,
  ParameterRange,
  ParameterType,
} from '@shared/types';

export default function parseParameters(script: string): Parameter[] {
  // Limit the script to the upper part of the file. We don't want to parse the
  // entire file, just the parameters. This can be done by searching for the
  // first occurence of the `module` or `function` keyword.
  script = script.split(/^(module |function )/m)[0];

  const parameters: Record<string, Parameter> = {};
  const parameterRegex =
    /^([a-z0-9A-Z_$]+)\s*=\s*([^;]+);[\t\f\cK ]*(\/\/[^\n]*)?/gm; // TODO: Use AST parser instead of regex
  const groupRegex = /^\/\*\s*\[([^\]]+)\]\s*\*\//gm;

  const groupSections: { id: string; group: string; code: string }[] = [
    {
      id: '',
      group: '',
      code: script,
    },
  ];
  let tmpGroup;

  // Find groups
  while ((tmpGroup = groupRegex.exec(script))) {
    groupSections.push({
      id: tmpGroup[0],
      group: tmpGroup[1].trim(),
      code: '',
    });
  }

  // Add code to groupSections
  groupSections.forEach((group, index) => {
    const nextGroup = groupSections[index + 1];
    const startIndex = script.indexOf(group.id);
    const endIndex = nextGroup ? script.indexOf(nextGroup.id) : script.length;
    group.code = script.substring(startIndex, endIndex);
  });

  // If we have more then one group, we need to adjust the code of the first group.
  // It should only have the code that is above the first group.
  if (groupSections.length > 1) {
    groupSections[0].code = script.substring(
      0,
      script.indexOf(groupSections[1].id),
    );
  }

  groupSections.forEach((groupSection) => {
    let match;
    while ((match = parameterRegex.exec(groupSection.code)) !== null) {
      const name = match[1];
      const value = match[2];
      let typeAndValue:
        | { value: Parameter['value']; type: Parameter['type'] }
        | undefined;
      try {
        typeAndValue = convertType(value);
      } catch {
        continue;
      }

      // If type and value cannot be determined, we do not use that parameter
      if (!typeAndValue) {
        continue;
      }

      let description: Parameter['description'] = undefined;
      let options: ParameterOption[] = [];
      let range: ParameterRange = {};

      // Check if the value is another variable or an expression. If so, we can continue to the next
      // parameter because everything after this variable (including itself) is not a parameter. Also
      // check if the value is a string that contains a newline. If so, we will also abort the parsing
      if (
        value !== 'true' && // true and false are valid values
        value !== 'false' &&
        (value.match(/^[a-zA-Z_]/) || value.split('\n').length > 1)
      ) {
        continue;
      }

      if (match[3]) {
        const rawComment = match[3].replace(/^\/\/\s*/, '').trim();
        const cleaned = rawComment.replace(/^\[+|\]+$/g, '');

        if (!isNaN(Number(rawComment))) {
          // If the cleaned comment is a number, then we assume that it is a step
          // value (or maximum length in case of a string)
          if (typeAndValue.type === 'string') {
            range = { max: parseFloat(cleaned) };
          } else {
            range = { step: parseFloat(cleaned) };
          }
        } else if (rawComment.startsWith('[') && cleaned.includes(',')) {
          // If the options contain commas, we assume that those are options for a select element.
          options = cleaned
            .trim()
            .split(',')
            .map((option) => {
              const parts = option.trim().split(':');
              let value: ParameterOption['value'] = parts[0];
              const label: ParameterOption['label'] = parts[1];
              if (typeAndValue.type === 'number') {
                value = parseFloat(value);
              }

              return { value, label };
            });
        } else if (cleaned.match(/([0-9]+:?)+/)) {
          // If the cleaned comment contains a colon, we assume that it is a range
          const [min, maxOrStep, max] = cleaned.trim().split(':');

          if (min && (maxOrStep || max)) {
            range = { min: parseFloat(min) };
          }
          if (max || maxOrStep || min) {
            range = { ...range, max: parseFloat(max || maxOrStep || min) };
          }
          if (max && maxOrStep) {
            range = { ...range, step: parseFloat(maxOrStep) };
          }
        }
      }

      // Now search for the comment right above the parameter definition. This is done
      // by splitting the script at the parameter definition and using the last line
      // before the definition.
      let above = script.split(
        new RegExp(`^${escapeRegExp(match[0])}`, 'gm'),
      )[0];

      // Remove only the last newline if it exists. If we would remove more than one
      // newline, we could remove an empty comment and use the comment above that.
      if (above.endsWith('\n')) {
        above = above.slice(0, -1);
      }

      const splitted = above.split('\n').reverse();

      const lastLineBeforeDefinition = splitted[0];
      if (lastLineBeforeDefinition.trim().startsWith('//')) {
        description = lastLineBeforeDefinition.replace(/^\/\/\/*\s*/, '');
        if (description.length === 0) {
          description = undefined;
        }
      }

      let displayName = name
        .replace(/_/g, ' ')
        .split(' ')
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join(' ');
      if (name === '$fn') {
        displayName = 'Resolution';
      }

      if (
        typeAndValue.type === 'number[]' &&
        Array.isArray(typeAndValue.value)
      ) {
        const labels = numberArrayLabels(name, typeAndValue.value.length);
        typeAndValue.value.forEach((itemValue, index) => {
          parameters[`${name}[${index}]`] = {
            description,
            group: groupSection.group,
            name: `${name}[${index}]`,
            displayName: displayNameForArrayItem(displayName, labels[index]),
            defaultValue: itemValue,
            range,
            options,
            value: itemValue,
            type: 'number',
          };
        });
        continue;
      }

      // Using names as keys to avoid duplicates
      parameters[name] = {
        description,
        group: groupSection.group,
        name,
        displayName,
        defaultValue: typeAndValue.value,
        range,
        options,
        ...typeAndValue,
      };
    }
  });

  return Object.values(parameters);
}

function numberArrayLabels(name: string, length: number) {
  if (length === 2) return ['X', 'Y'];
  if (length !== 3) return Array.from({ length }, (_, index) => `${index + 1}`);

  const lowerName = name.toLowerCase();
  if (
    lowerName.includes('size') ||
    lowerName.includes('dimension') ||
    lowerName.includes('body') ||
    lowerName.includes('torso') ||
    lowerName.includes('head') ||
    lowerName.includes('foot') ||
    lowerName.includes('base')
  ) {
    return ['Width', 'Depth', 'Height'];
  }

  return ['X', 'Y', 'Z'];
}

function displayNameForArrayItem(displayName: string, label: string) {
  if (['Width', 'Depth', 'Height'].includes(label)) {
    return displayName.replace(/\s+Size$/i, '') + ` ${label}`;
  }
  return `${displayName} ${label}`;
}

function convertType(rawValue: string): {
  value: string | boolean | number | string[] | number[] | boolean[];
  type: ParameterType;
} {
  if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
    // Raw value matches something like `123.123` or `123`.
    return { value: parseFloat(rawValue), type: 'number' };
  } else if (rawValue === 'true' || rawValue === 'false') {
    // Raw value matches `true` or `false`.
    return { value: rawValue === 'true', type: 'boolean' };
  } else if (/^".*"$/.test(rawValue)) {
    // Raw value is a string aka ends and starts with a quote
    rawValue = rawValue.replace(/^"(.*)"$/, '$1');
    return { value: rawValue, type: 'string' };
  } else if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
    // Raw values is an array
    const arrayValue = rawValue
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim());

    if (
      arrayValue.length > 0 &&
      arrayValue.every((item) => /^\d+(\.\d+)?$/.test(item))
    ) {
      return {
        value: arrayValue.map((item) => parseFloat(item)),
        type: 'number[]',
      };
    } else if (
      arrayValue.length > 0 &&
      arrayValue.every((item) => /^".*"$/.test(item))
    ) {
      // Assume that an empty array is a string array
      return {
        value: arrayValue.map((item) => item.slice(1, -1)),
        type: 'string[]',
      };
    } else if (
      arrayValue.length > 0 &&
      arrayValue.every((item) => item === 'true' || item === 'false')
    ) {
      return {
        value: arrayValue.map((item) => item === 'true'),
        type: 'boolean[]',
      };
    }
    throw new Error(
      `Invalid array value: ${rawValue}. Array elements must be all numbers, all booleans, or all quoted strings and not empty.`,
    );
  } else {
    // Throw an error if the value is not a number, boolean, or string
    throw new Error(`Invalid value: ${rawValue}`);
  }
}

// https://stackoverflow.com/a/6969486/1706846
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
