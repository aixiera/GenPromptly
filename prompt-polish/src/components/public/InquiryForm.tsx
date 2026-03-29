"use client";

import { useMemo, useState } from "react";

type InquiryFormProps = {
  email: string;
};

export function InquiryForm({ email }: InquiryFormProps) {
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [projectType, setProjectType] = useState("Consultation");
  const [timeline, setTimeline] = useState("");
  const [details, setDetails] = useState("");

  const mailtoHref = useMemo(() => {
    const subject = `${projectType} inquiry from ${name || "website visitor"}`;
    const body = [
      `Name: ${name || "-"}`,
      `Email: ${contactEmail || "-"}`,
      `Project type: ${projectType}`,
      `Timeline: ${timeline || "-"}`,
      "",
      "Project details:",
      details || "-",
    ].join("\n");

    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [contactEmail, details, email, name, projectType, timeline]);

  return (
    <form
      className="brand-card inquiry-form"
      onSubmit={(event) => {
        event.preventDefault();
        window.location.href = mailtoHref;
      }}
    >
      <div className="inquiry-form-heading">
        <p className="brand-section-eyebrow">Inquiry form</p>
        <h2 className="brand-card-title">Start with a structured message</h2>
        <p className="brand-card-text">
          This form opens your email client with a drafted inquiry so the details arrive in a clear format.
        </p>
      </div>

      <label className="brand-field">
        <span>Name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
      </label>

      <label className="brand-field">
        <span>Email</span>
        <input
          type="email"
          value={contactEmail}
          onChange={(event) => setContactEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </label>

      <label className="brand-field">
        <span>Project type</span>
        <select value={projectType} onChange={(event) => setProjectType(event.target.value)}>
          <option>Consultation</option>
          <option>Workflow audit</option>
          <option>Starter automation setup</option>
          <option>Custom AI / n8n implementation</option>
          <option>Ongoing support</option>
          <option>Digital resources</option>
          <option>GenPromptly</option>
        </select>
      </label>

      <label className="brand-field">
        <span>Timeline</span>
        <input
          value={timeline}
          onChange={(event) => setTimeline(event.target.value)}
          placeholder="This month, next quarter, flexible, etc."
        />
      </label>

      <label className="brand-field">
        <span>Details</span>
        <textarea
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="Share the workflow, problem, or idea you want help with."
          rows={6}
        />
      </label>

      <button type="submit" className="brand-button brand-button--primary">
        Draft email inquiry
      </button>
    </form>
  );
}
