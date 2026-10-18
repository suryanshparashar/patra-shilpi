import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { Children } from "react";

import type { StructuredResume } from "@/lib/schemas";
import { registerPdfFonts } from "@/pdf/fonts";

registerPdfFonts();

// Minimal, single-column, ATS-safe: hierarchy comes from weight and size only. No letter
// spacing on headings: ATS text extraction reads spaced letters as separate words.
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Inter", lineHeight: 1.4, color: "#111111" },
  name: { fontSize: 20, fontWeight: 700 },
  contact: { marginTop: 4, color: "#444444" },
  section: { marginTop: 14 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  item: { marginBottom: 7 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  // The title takes the free width and wraps; the date keeps its size, so they never overlap.
  rowTitle: { flex: 1, paddingRight: 8, fontWeight: 700 },
  rowDate: { flexShrink: 0, color: "#555555" },
  bold: { fontWeight: 700 },
  muted: { color: "#555555" },
  bullet: { flexDirection: "row", marginTop: 2 },
  bulletMark: { width: 10 },
  bulletText: { flex: 1 },
});

function join(parts: (string | null | undefined)[], separator = ", "): string {
  return parts.filter(Boolean).join(separator);
}

/** "B.Tech in Computer Science", leaving the field out when the institution's name already says
 * it ("Department of Computer Science"), so it is not printed twice. */
function degreeLine(edu: StructuredResume["education"][number]): string {
  const field = edu.field_of_study;
  const repeated = field && edu.institution.toLowerCase().includes(field.toLowerCase());
  return join([edu.degree, repeated ? null : field], " in ");
}

function dateRange(start: string | null, end: string | null): string {
  return join([start, end], " - ");
}

function Bullets({ items }: { items: string[] }) {
  return (
    <>
      {items.map((text, i) => (
        <View key={i} style={styles.bullet} wrap={false}>
          <Text style={styles.bulletMark}>•</Text>
          <Text style={styles.bulletText}>{text}</Text>
        </View>
      ))}
    </>
  );
}

/** A heading is kept on the same page as the section's first entry (a role, a project, a
 * paragraph), so it can never sit alone at the bottom of a page. The rest flows normally. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [first, ...rest] = Children.toArray(children);
  return (
    <View style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {first}
      </View>
      {rest}
    </View>
  );
}

export function ResumePdf({ resume }: { resume: StructuredResume }) {
  const { contact } = resume;
  return (
    <Document title={`${contact.name ?? "Resume"} - Resume`} author={contact.name ?? undefined}>
      <Page size="A4" style={styles.page}>
        {contact.name ? <Text style={styles.name}>{contact.name}</Text> : null}
        <Text style={styles.contact}>
          {join([contact.email, contact.phone, contact.location, ...contact.links], "  |  ")}
        </Text>

        {resume.summary ? (
          <Section title="Summary">
            <Text>{resume.summary}</Text>
          </Section>
        ) : null}

        {resume.skills.length ? (
          <Section title="Skills">
            <Text>{resume.skills.join(", ")}</Text>
          </Section>
        ) : null}

        {resume.experience.length ? (
          <Section title="Experience">
            {resume.experience.map((job, i) => (
              <View key={i} style={styles.item}>
                <View style={styles.row} wrap={false}>
                  <Text style={styles.rowTitle}>{join([job.title, job.company])}</Text>
                  <Text style={styles.rowDate}>{dateRange(job.start_date, job.end_date)}</Text>
                </View>
                {job.location ? <Text style={styles.muted}>{job.location}</Text> : null}
                <Bullets items={job.bullets} />
              </View>
            ))}
          </Section>
        ) : null}

        {resume.projects.length ? (
          <Section title="Projects">
            {resume.projects.map((project, i) => (
              <View key={i} style={styles.item}>
                <Text style={styles.bold}>
                  {project.name}
                  {project.technologies.length ? ` (${project.technologies.join(", ")})` : ""}
                </Text>
                {project.description ? <Text>{project.description}</Text> : null}
                <Bullets items={project.bullets} />
              </View>
            ))}
          </Section>
        ) : null}

        {resume.education.length ? (
          <Section title="Education">
            {resume.education.map((edu, i) => (
              <View key={i} style={styles.item} wrap={false}>
                <View style={styles.row}>
                  <Text style={styles.rowTitle}>{join([degreeLine(edu), edu.institution])}</Text>
                  <Text style={styles.rowDate}>{dateRange(edu.start_date, edu.end_date)}</Text>
                </View>
                <Bullets items={edu.details} />
              </View>
            ))}
          </Section>
        ) : null}

        {resume.certifications.length ? (
          <Section title="Certifications">
            <Bullets items={resume.certifications} />
          </Section>
        ) : null}

        {resume.additional.length ? (
          <Section title="Additional">
            {resume.additional.map((line, i) => (
              <Text key={i}>{line}</Text>
            ))}
          </Section>
        ) : null}
      </Page>
    </Document>
  );
}
