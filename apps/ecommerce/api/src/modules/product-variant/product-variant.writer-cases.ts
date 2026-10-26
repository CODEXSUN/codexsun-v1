import { canonicalStoredOptionSignature } from "./product-variant.identity.js";

// Public synthetic inputs for the separate MariaDB staging acceptance run.
export const variantWriterParityCases = [
  [" Size ", "Large", "Colour", " BLUE ", "", ""],
  ["colour", "blue", "size", "large", "", ""],
  ['quote"\\', "line\n\t\r\u0000\b\f", "", "", "", ""],
  ["தமிழ்", "பச்சை", "École", "CAFÉ", "", ""],
  ["\u00a0İ\ufeff", "Ο\u0301Σ", "ΟΣΑ", "ΟΣ", "", ""],
  ["\u{10000}", "Emoji😀", "\ue000", "value", "", ""],
  ["", "", "", "", "", ""],
  ["partial", "", "", "value", "same", "same"],
  ["a", "=|,[]", "a", "duplicate legacy name", "", ""]
].map((columns) => {
  const input = {
    option1Name: columns[0]!,
    option1Value: columns[1]!,
    option2Name: columns[2]!,
    option2Value: columns[3]!,
    option3Name: columns[4]!,
    option3Value: columns[5]!
  };
  return { columns, expectedSignature: canonicalStoredOptionSignature(input) };
});
