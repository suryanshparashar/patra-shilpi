import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { StructuredResume } from "@/lib/schemas";

// Minimal, single-column, ATS-safe: hierarchy comes from weight and size only.
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", lineHeight: 1.4, color: "#111111" },
  name: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  contact: { marginTop: 4, color: "#444444" },
  section: { marginTop: 14 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  item: { marginBottom: 7 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  bold: { fontFamily: "Helvetica-Bold" },
  muted: { color: "#555555" },
  bullet: { flexDirection: "row", marginTop: 2 },
  bulletMark: { width: 10 },
  bulletText: { flex: 1 },
});

function join(parts: (string | null | undefined)[], separator = ", "): string {
  return parts.filter(Boolean).join(separator);
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} minPresenceAhead={40}>
        {title}
      </Text>
      {children}
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
                  <Text style={styles.bold}>{join([job.title, job.company])}</Text>
                  <Text style={styles.muted}>{dateRange(job.start_date, job.end_date)}</Text>
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
                  <Text style={styles.bold}>
                    {join([join([edu.degree, edu.field_of_study], " in "), edu.institution])}
                  </Text>
                  <Text style={styles.muted}>{dateRange(edu.start_date, edu.end_date)}</Text>
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
