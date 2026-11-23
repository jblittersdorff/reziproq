import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { Eyebrow, Lead, NumberCircle, PageTitle, Wrap } from '../components/site';
import { useSite } from '../i18n';
import { contactEmail } from '../site';

// WEB-01, Seite „Kontakt“ nach Vorlage Contact. Bewusste Abweichung: Solange es keinen
// Maildienst gibt (Block C), sendet das Formular nicht selbst, sondern öffnet das Mailprogramm
// mit der ausgefüllten Anfrage an contactEmail. Die Vorlage zeigt danach „Danke“; wir sagen,
// was wirklich passiert.

export interface ContactRequest {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  role: string;
  interest: string;
  message: string;
}

/** mailto-Adresse mit Betreff und Text aus dem Formular */
export function mailtoHref(
  request: ContactRequest,
  labels: {
    subject: string;
    firstName: string;
    lastName: string;
    email: string;
    company: string;
    role: string;
    interest: string;
    message: string;
  },
): string {
  const lines = [
    `${labels.firstName}: ${request.firstName}`,
    `${labels.lastName}: ${request.lastName}`,
    `${labels.email}: ${request.email}`,
    `${labels.company}: ${request.company}`,
    `${labels.role}: ${request.role}`,
    `${labels.interest}: ${request.interest}`,
    '',
    request.message,
  ];
  const subject = `${labels.subject} · ${request.interest}`;
  return `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n').trim())}`;
}

export function ContactPage() {
  const { text, href } = useSite();
  const page = text.contact;
  const form = page.form;
  const [opened, setOpened] = useState(false);
  const [consent, setConsent] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? '').trim();
    window.location.href = mailtoHref(
      {
        firstName: value('firstName'),
        lastName: value('lastName'),
        email: value('email'),
        company: value('company'),
        role: value('role'),
        interest: value('interest'),
        message: value('message'),
      },
      form,
    );
    setOpened(true);
  };

  return (
    <section className="py-site-section">
      <Wrap className="flex flex-wrap items-start gap-x-16 gap-y-12">
        <div className="flex min-w-0 flex-1 basis-95 flex-col gap-6.5">
          <Eyebrow>{page.eyebrow}</Eyebrow>
          <PageTitle>{page.title}</PageTitle>
          <Lead>{page.lead}</Lead>
          <div className="mt-2 flex flex-col gap-4.5">
            <h2 className="font-display font-semibold text-ink text-xl">{page.next}</h2>
            <ol className="flex flex-col gap-4">
              {page.steps.map((step, index) => (
                <li key={step} className="flex items-center gap-3.5">
                  <NumberCircle>{index + 1}</NumberCircle>
                  <strong className="font-display font-semibold text-ink text-lg">{step}</strong>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col gap-1.5 border-line border-t pt-5.5 text-base text-muted-strong">
            <span>
              {page.email}{' '}
              <a
                href={`mailto:${contactEmail}`}
                className="font-semibold text-petrol underline underline-offset-2"
              >
                {contactEmail}
              </a>
            </span>
            <span>{page.place}</span>
          </div>
        </div>

        <div className="min-w-0 flex-[1.1] basis-115 rounded-site-lg bg-card p-6 shadow-site-frame sm:p-10">
          <form
            onSubmit={submit}
            // Ohne JavaScript übernimmt der Browser: mailto mit den Feldern als Text
            action={`mailto:${contactEmail}`}
            method="post"
            encType="text/plain"
            className="flex flex-col gap-4.5"
          >
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(50),100%),1fr))] gap-5">
              <FormField label={form.firstName}>
                {(field) => (
                  <Input {...field} name="firstName" autoComplete="given-name" required />
                )}
              </FormField>
              <FormField label={form.lastName}>
                {(field) => (
                  <Input {...field} name="lastName" autoComplete="family-name" required />
                )}
              </FormField>
            </div>
            <FormField label={form.email}>
              {(field) => (
                <Input {...field} name="email" type="email" autoComplete="email" required />
              )}
            </FormField>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(50),100%),1fr))] gap-5">
              <FormField label={form.company}>
                {(field) => (
                  <Input {...field} name="company" autoComplete="organization" required />
                )}
              </FormField>
              <FormField label={form.role}>
                {(field) => <Input {...field} name="role" autoComplete="organization-title" />}
              </FormField>
            </div>
            <FormField label={form.interest}>
              {(field) => (
                <NativeSelect {...field} name="interest" defaultValue={form.interests[0]}>
                  {form.interests.map((interest) => (
                    <option key={interest}>{interest}</option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField label={form.message}>
              {(field) => <Textarea {...field} name="message" placeholder={form.placeholder} />}
            </FormField>
            <div className="flex items-start gap-3">
              <Checkbox
                id="consent"
                name="consent"
                required
                checked={consent}
                onCheckedChange={(next) => setConsent(next === true)}
                className="mt-0.5"
              />
              <label htmlFor="consent" className="text-muted-strong text-sm">
                {form.consent}{' '}
                <a
                  href={href('legal', 'privacy')}
                  className="font-semibold text-petrol underline underline-offset-2"
                >
                  {form.privacy}
                </a>
                .
              </label>
            </div>
            <Button type="submit" size="lg" className="self-start">
              {form.send}
            </Button>
            <p
              role="status"
              className={
                opened
                  ? 'rounded-lg bg-mint-soft px-4 py-3 text-base text-petrol-dark'
                  : 'text-muted-foreground text-sm'
              }
            >
              {form.mailNote}
            </p>
          </form>
        </div>
      </Wrap>
    </section>
  );
}
