import AppShell from '@/components/layout/AppShell'

export const metadata = {
  title: 'Community Guidelines',
  description: 'HapiEats TV community guidelines — how to be a great creator and viewer on our platform.',
}

export default function GuidelinesPage() {
  return (
    <AppShell>
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Community Guidelines</h1>
        <p className="text-muted-foreground mb-10">Effective date: June 2026</p>

        <div className="space-y-8 text-muted-foreground leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Our Mission</h2>
            <p>HapiEats TV exists to celebrate food, cooking, and the people who make it. We want this platform to be a joyful, respectful space where food creators can share their passion and viewers can discover incredible food content from around the world.</p>
            <p className="mt-2">These guidelines apply to all content uploaded to HapiEats TV — videos, live streams, comments, channel descriptions, profile bios, and any other content you create on the platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Content That Is Welcome</h2>
            <p>HapiEats TV is for food-focused content. We love seeing:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Cooking tutorials, recipe demonstrations, and technique breakdowns</li>
              <li>Food travel, restaurant visits, and market tours</li>
              <li>Meal prep, nutrition content, and healthy eating guides</li>
              <li>Cultural food traditions and family recipes</li>
              <li>Food reviews, taste tests, and eating challenges</li>
              <li>Kitchen equipment reviews and cooking tips</li>
              <li>Live cooking shows and interactive food experiences</li>
              <li>Food storytelling and creator-behind-the-scenes content</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Content That Is Not Allowed</h2>
            <p>The following content will be removed and may result in account suspension or termination:</p>

            <h3 className="text-base font-semibold text-foreground mt-4 mb-1">Hate Speech &amp; Harassment</h3>
            <p>Content that promotes hatred, violence, or discrimination based on race, ethnicity, national origin, religion, gender, sexual orientation, disability, or other protected characteristics. Personal attacks, threats, doxxing, or coordinated harassment of any individual or group.</p>

            <h3 className="text-base font-semibold text-foreground mt-4 mb-1">Sexual Content</h3>
            <p>Explicit sexual content or nudity. Content that sexualizes minors in any way is strictly prohibited and will be reported to relevant authorities.</p>

            <h3 className="text-base font-semibold text-foreground mt-4 mb-1">Violence &amp; Dangerous Content</h3>
            <p>Graphic depictions of violence, animal cruelty, or content that promotes self-harm. Content that instructs viewers on how to engage in dangerous or illegal activities.</p>

            <h3 className="text-base font-semibold text-foreground mt-4 mb-1">Misinformation</h3>
            <p>Demonstrably false health or nutrition claims that could endanger viewers. Content that promotes unapproved medical treatments or dangerous dieting practices.</p>

            <h3 className="text-base font-semibold text-foreground mt-4 mb-1">Spam &amp; Scams</h3>
            <p>Artificially inflated views, comments, or engagement. Misleading titles, thumbnails, or descriptions designed to deceive viewers. Phishing, pyramid schemes, or fraudulent offers.</p>

            <h3 className="text-base font-semibold text-foreground mt-4 mb-1">Copyright Infringement</h3>
            <p>Uploading content you do not own or have permission to use, including music, video clips, and images. We comply fully with the DMCA. See our <a href="/terms" className="text-primary hover:underline">Terms of Service</a> and contact <a href="mailto:dmca@hapieatstv.com" className="text-primary hover:underline">dmca@hapieatstv.com</a> for DMCA notices.</p>

            <h3 className="text-base font-semibold text-foreground mt-4 mb-1">Impersonation</h3>
            <p>Pretending to be another creator, celebrity, or HapiEats TV staff. Using misleading account names or branding.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Age Requirements</h2>
            <p>You must be at least 18 years old to create an account, upload content, or use paid features on HapiEats TV. If you are under 18, please do not register. Content featuring minors must clearly show adult supervision and must not sexualize or exploit children in any way.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Food Safety</h2>
            <p>Creators are responsible for ensuring the food practices shown in their content are safe and do not endanger viewers. Please include appropriate disclaimers when demonstrating dishes that contain common allergens (nuts, shellfish, gluten, dairy, eggs, soy, sesame) or require specialized equipment or techniques. HapiEats TV is not responsible for any harm resulting from viewers attempting to replicate content.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Sponsored Content &amp; Disclosures</h2>
            <p>If a video includes paid promotions, sponsorships, gifted products, or affiliate links, you must disclose this clearly in the video and/or description. This is required by FTC guidelines and our platform policies. Failure to disclose paid partnerships may result in content removal.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Comments &amp; Interactions</h2>
            <p>Be kind and respectful in comments and live chat. The same content standards that apply to videos apply to comments. Creators may moderate their own comment sections. Repeated violations of these guidelines in comments may result in comment restrictions or account suspension.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Monetization Standards</h2>
            <p>To participate in HapiEats TV's monetization features — subscriptions, Flavor Points gifts, pay-per-view, or cashouts — your content must meet all community guidelines. Monetization access may be suspended if content violates these standards. See our <a href="/creator-agreement" className="text-primary hover:underline">Creator Monetization Agreement</a> for full details.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Enforcement</h2>
            <p>We take violations seriously. Depending on the severity and frequency, enforcement may include:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Content removal</li>
              <li>A warning and required policy review</li>
              <li>Temporary suspension of upload, commenting, or monetization privileges</li>
              <li>Permanent account termination</li>
              <li>Reporting to law enforcement where required</li>
            </ul>
            <p className="mt-2">We review reported content as quickly as possible. If your content was removed and you believe it was a mistake, contact us at <a href="mailto:trust@hapieatstv.com" className="text-primary hover:underline">trust@hapieatstv.com</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. Reporting Violations</h2>
            <p>If you see content that violates these guidelines, please use the Report button on the video or contact us at <a href="mailto:trust@hapieatstv.com" className="text-primary hover:underline">trust@hapieatstv.com</a>. We investigate all reports and appreciate the community's help in keeping HapiEats TV a great place for food lovers.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">10. Changes to These Guidelines</h2>
            <p>We may update these guidelines as the platform evolves. We'll notify creators of material changes by email. Continued use of the platform after changes are posted constitutes acceptance of the updated guidelines.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Questions?</h2>
            <p>Contact our Trust &amp; Safety team at <a href="mailto:trust@hapieatstv.com" className="text-primary hover:underline">trust@hapieatstv.com</a>.</p>
          </section>

        </div>
      </main>
    </AppShell>
  )
}
