import { sql } from "kysely";
import { getEcommerceDatabase } from "../../database/ecommerce-database.js";
import { canonicalOptionSignatureFor } from "./product-variant.identity.js";
export async function seedProductVariantModule() {
  await sql`UPDATE ecommerce_product_variants SET status='inactive' WHERE status NOT IN ('active','inactive')`.execute(
    getEcommerceDatabase()
  );
  for (let index = 0; index < variants.length; index += 1) {
    const item = variants[index]!;
    const optionSignature = canonicalOptionSignatureFor({
      option1Name: "Configuration",
      option1Value: item.configuration,
      option2Name: "",
      option2Value: "",
      option3Name: "",
      option3Value: ""
    });
    await sql`INSERT INTO ecommerce_product_variants
      (uuid,product_information_id,sku,title,barcode,option_1_name,option_1_value,option_signature,
       price_adjustment,compare_at_adjustment,cost_adjustment,weight,sort_order,status,created_by)
      SELECT LOWER(HEX(RANDOM_BYTES(4))),product.id,${item.sku},${item.title},${item.barcode},
        'Configuration',${item.configuration},${optionSignature},
        0,${item.compareAtAdjustment},0,0,${index + 1},'active','system:catalog-seed'
      FROM ecommerce_product_information product WHERE product.slug=${item.slug}
        AND NOT EXISTS (SELECT 1 FROM ecommerce_product_variants WHERE sku=${item.sku}) LIMIT 1`.execute(
      getEcommerceDatabase()
    );
  }
}

const variants = [
  {
    barcode: "890100000001",
    compareAtAdjustment: 5000,
    configuration: "16 GB / 512 GB",
    sku: "ACR-A515-I5-16-512",
    slug: "acer-aspire-5-15",
    title: "Core i5 · 16 GB · 512 GB"
  },
  {
    barcode: "890100000002",
    compareAtAdjustment: 6000,
    configuration: "16 GB / 512 GB",
    sku: "ASU-V15-OLED-16-512",
    slug: "asus-vivobook-15-oled",
    title: "OLED · 16 GB · 512 GB"
  },
  {
    barcode: "890100000003",
    compareAtAdjustment: 7000,
    configuration: "16 GB / 1 TB",
    sku: "LEN-IPS5-R7-16-1T",
    slug: "lenovo-ideapad-slim-5",
    title: "Ryzen 7 · 16 GB · 1 TB"
  },
  {
    barcode: "890100000004",
    compareAtAdjustment: 4000,
    configuration: "16 GB / 1 TB",
    sku: "DEL-INS-CMP-I5",
    slug: "dell-inspiron-compact-desktop",
    title: "Core i5 · 16 GB · 1 TB"
  },
  {
    barcode: "890100000005",
    compareAtAdjustment: 2500,
    configuration: "27-inch QHD",
    sku: "SAM-VF27-QHD",
    slug: "samsung-viewfinity-27",
    title: "27-inch · QHD"
  },
  {
    barcode: "890100000006",
    compareAtAdjustment: 1000,
    configuration: "Graphite",
    sku: "LOG-MXM3-GR",
    slug: "logitech-mx-master-mouse",
    title: "Graphite"
  },
  {
    barcode: "890100000007",
    compareAtAdjustment: 1200,
    configuration: "Graphite",
    sku: "LOG-MXK-GR",
    slug: "logitech-mx-keys-keyboard",
    title: "Graphite"
  },
  {
    barcode: "890100000008",
    compareAtAdjustment: 800,
    configuration: "7-port",
    sku: "HP-USBC-HUB-7",
    slug: "hp-usb-c-universal-hub",
    title: "7-port Universal Hub"
  }
] as const;
