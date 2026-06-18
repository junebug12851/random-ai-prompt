import fs from "node:fs";

export default function (imageSettings) {
  try {
    // Write results file
    fs.writeFileSync(
      "./results.json",
      JSON.stringify(
        {
          prompts: imageSettings.resultPrompts,
          images: imageSettings.resultImages,
        },
        null,
        4,
      ),
    );
  } catch (err) {
    console.error(err);
  }
}
