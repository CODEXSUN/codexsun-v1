import unicode from "./product-variant.unicode.json" with { type: "json" };

const text = (value: string) => `CONVERT(0x${Buffer.from(value).toString("hex")} USING utf8mb4)`;
const whitespace = Array.from(
  "\u0009\u000a\u000b\u000c\u000d \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff"
);
const trimSet = whitespace
  .map((character) => `'${Buffer.from(character).toString("hex").toUpperCase()}'`)
  .join(",");

// Frozen Unicode data avoids server collation/version differences from JavaScript lowercasing.
export function variantWriterRoutines(): readonly string[] {
  const lowerCases = Object.entries(unicode.lower)
    .map(
      ([from, to]) => `WHEN '${Buffer.from(from).toString("hex").toUpperCase()}' THEN ${text(to)}`
    )
    .join("\n");
  return [
    `CREATE FUNCTION ecommerce_variant_normalize_v1(input_value TEXT CHARACTER SET utf8mb4)
    RETURNS TEXT CHARACTER SET utf8mb4 DETERMINISTIC NO SQL
    BEGIN
      DECLARE value_text TEXT CHARACTER SET utf8mb4;
      DECLARE result_text TEXT CHARACTER SET utf8mb4 DEFAULT '';
      DECLARE letter TEXT CHARACTER SET utf8mb4;
      DECLARE position_index INT DEFAULT 1;
      DECLARE scan_index INT;
      DECLARE before_cased BOOLEAN;
      DECLARE after_cased BOOLEAN;
      SET value_text=COALESCE(input_value,'');
      WHILE CHAR_LENGTH(value_text)>0 AND HEX(LEFT(value_text,1)) IN (${trimSet}) DO
        SET value_text=SUBSTRING(value_text,2);
      END WHILE;
      WHILE CHAR_LENGTH(value_text)>0 AND HEX(RIGHT(value_text,1)) IN (${trimSet}) DO
        SET value_text=LEFT(value_text,CHAR_LENGTH(value_text)-1);
      END WHILE;
      WHILE position_index<=CHAR_LENGTH(value_text) DO
        SET letter=SUBSTRING(value_text,position_index,1);
        IF HEX(letter)='CEA3' THEN
          SET scan_index=position_index-1;
          WHILE scan_index>0 AND LOCATE(BINARY SUBSTRING(value_text,scan_index,1),BINARY ${text(unicode.ignorable)})>0 DO
            SET scan_index=scan_index-1;
          END WHILE;
          SET before_cased=scan_index>0 AND LOCATE(BINARY SUBSTRING(value_text,scan_index,1),BINARY ${text(unicode.cased)})>0;
          SET scan_index=position_index+1;
          WHILE scan_index<=CHAR_LENGTH(value_text) AND LOCATE(BINARY SUBSTRING(value_text,scan_index,1),BINARY ${text(unicode.ignorable)})>0 DO
            SET scan_index=scan_index+1;
          END WHILE;
          SET after_cased=scan_index<=CHAR_LENGTH(value_text) AND LOCATE(BINARY SUBSTRING(value_text,scan_index,1),BINARY ${text(unicode.cased)})>0;
          SET letter=IF(before_cased AND NOT after_cased,${text("ς")},${text("σ")});
        ELSE
          SET letter=CASE HEX(letter) ${lowerCases} ELSE letter END;
        END IF;
        SET result_text=CONCAT(result_text,letter);
        SET position_index=position_index+1;
      END WHILE;
      RETURN result_text;
    END`,
    quoteRoutine(),
    signatureRoutine()
  ];
}

function quoteRoutine() {
  return `CREATE FUNCTION ecommerce_variant_quote_v1(input_value TEXT CHARACTER SET utf8mb4)
  RETURNS TEXT CHARACTER SET utf8mb4 DETERMINISTIC NO SQL
  BEGIN
    DECLARE result_text TEXT CHARACTER SET utf8mb4 DEFAULT 0x22;
    DECLARE letter TEXT CHARACTER SET utf8mb4;
    DECLARE position_index INT DEFAULT 1;
    WHILE position_index<=CHAR_LENGTH(input_value) DO
      SET letter=SUBSTRING(input_value,position_index,1);
      SET result_text=CONCAT(result_text,CASE HEX(letter)
        WHEN '22' THEN 0x5c22 WHEN '5C' THEN 0x5c5c
        WHEN '08' THEN 0x5c62 WHEN '09' THEN 0x5c74 WHEN '0A' THEN 0x5c6e
        WHEN '0C' THEN 0x5c66 WHEN '0D' THEN 0x5c72
        ELSE IF(ORD(letter)<32,CONCAT(0x5c753030,LOWER(LPAD(HEX(letter),2,'0'))),letter) END);
      SET position_index=position_index+1;
    END WHILE;
    RETURN CONCAT(result_text,0x22);
  END`;
}

function signatureRoutine() {
  const names = [1, 2, 3];
  const swaps = [
    [1, 2],
    [2, 3],
    [1, 2]
  ]
    .map(
      ([a, b]) => `
    IF CAST(CONVERT(n${a} USING utf16) AS BINARY)>CAST(CONVERT(n${b} USING utf16) AS BINARY)
      OR (BINARY n${a}=BINARY n${b} AND CAST(CONVERT(v${a} USING utf16) AS BINARY)>CAST(CONVERT(v${b} USING utf16) AS BINARY)) THEN
      SET temporary=n${a}; SET n${a}=n${b}; SET n${b}=temporary;
      SET temporary=v${a}; SET v${a}=v${b}; SET v${b}=temporary;
    END IF;`
    )
    .join("\n");
  return `CREATE FUNCTION ecommerce_variant_signature_v1(${names.flatMap((i) => [`n${i} TEXT CHARACTER SET utf8mb4`, `v${i} TEXT CHARACTER SET utf8mb4`]).join(",")})
    RETURNS CHAR(64) CHARACTER SET ascii DETERMINISTIC NO SQL
    BEGIN
      DECLARE temporary TEXT CHARACTER SET utf8mb4;
      DECLARE payload TEXT CHARACTER SET utf8mb4 DEFAULT '[';
      ${names.map((i) => `SET n${i}=ecommerce_variant_normalize_v1(n${i}); SET v${i}=ecommerce_variant_normalize_v1(v${i});`).join("\n")}
      ${swaps}
      ${names
        .map(
          (i) => `IF CHAR_LENGTH(n${i})>0 OR CHAR_LENGTH(v${i})>0 THEN
        IF CHAR_LENGTH(payload)>1 THEN SET payload=CONCAT(payload,','); END IF;
        SET payload=CONCAT(payload,'[',ecommerce_variant_quote_v1(n${i}),',',ecommerce_variant_quote_v1(v${i}),']');
      END IF;`
        )
        .join("\n")}
      RETURN SHA2(CONCAT(payload,']'),256);
    END`;
}

export function variantWriterTrigger(event: "INSERT" | "UPDATE") {
  const columns = [1, 2, 3].flatMap((i) => [`NEW.option_${i}_name`, `NEW.option_${i}_value`]);
  return `CREATE TRIGGER ecommerce_variant_signature_${event.toLowerCase()}_v1
    BEFORE ${event} ON ecommerce_product_variants FOR EACH ROW
    BEGIN
      SET NEW.option_signature=ecommerce_variant_signature_v1(${columns.join(",")});
      ${event === "UPDATE" ? "SET NEW.revision=OLD.revision+1;" : ""}
    END`;
}
