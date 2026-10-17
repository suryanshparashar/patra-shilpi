import { Document, Page, StyleSheet, Text } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 56, fontSize: 11, fontFamily: "Helvetica", lineHeight: 1.5, color: "#111111" },
  paragraph: { marginBottom: 12 },
});

export function CoverLetterPdf({ text, name }: { text: string; name?: string | null }) {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim());
  return (
    <Document title={`${name ?? "Cover letter"} - Cover letter`} author={name ?? undefined}>
      <Page size="A4" style={styles.page}>
        {paragraphs.map((paragraph, i) => (
          <Text key={i} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}
      </Page>
    </Document>
  );
}
