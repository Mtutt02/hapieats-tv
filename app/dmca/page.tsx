import type { Metadata } from 'next'
import AppShell from '@/components/layout/AppShell'

export const metadata: Metadata = {
  title: 'DMCA / Copyright Policy',
  description: 'HapiEats TV DMCA and copyright policy — how to submit infringement notices and counter-notices, and our repeat-infringer policy.',
}

export default function DmcaPage() {
  return (
    <AppShell>
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">DMCA / Copyright Policy</h1>
        <p className="text-muted-foreground mb-10">Last updated: July 8, 2026</p>

        <div className="space-y-8 text-muted-foreground leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Our Commitment</h2>
            <p>HapiEats TV respects intellectual property rights and expects the same of its community. In accordance with the Digital Millennium Copyright Act, 17 U.S.C. § 512 ("DMCA"), we respond promptly to valid infringement notices covering any content on the Platform — uploaded videos, live streams and their recordings, recipe cards, thumbnails, class materials, chat content, and music or footage contained within them — and we terminate repeat infringers. This policy is part of our <a href="/terms" className="text-primary hover:underline">Terms &amp; Conditions</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Filing an Infringement Notice</h2>
            <p>If you believe your copyrighted work is being infringed on HapiEats TV, send a written notice to our designated agent (Section 5) containing all of the following:</p>
            <ol className="list-decimal pl-6 mt-2 space-y-1">
              <li>Identification of the copyrighted work you claim is infringed (or a representative list if multiple works are covered by one notice).</li>
              <li>Identification of the infringing material and information reasonably sufficient for us to locate it — for HapiEats TV, the full URL of the video, live stream, class, or profile (e.g., https://hapieatstv.com/watch/... or /live/...).</li>
              <li>Your contact information: name, mailing address, telephone number, and email address.</li>
              <li>A statement that you have a good-faith belief that the use of the material is not authorized by the copyright owner, its agent, or the law.</li>
              <li>A statement that the information in the notice is accurate and, <strong className="text-foreground">under penalty of perjury</strong>, that you are the copyright owner or authorized to act on the owner's behalf.</li>
              <li>Your physical or electronic signature.</li>
            </ol>
            <p className="mt-2">On receipt of a valid notice we will remove or disable access to the material expeditiously — for live streams this may mean interrupting the stream — and notify the uploader with a copy of your notice. Misrepresenting that material is infringing can make you liable for damages (including costs and attorneys' fees) under 17 U.S.C. § 512(f). Consider whether the use may be a fair use before filing.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Filing a Counter-Notice</h2>
            <p>If your content was removed and you believe this was a mistake or misidentification, you may send a written counter-notice to our designated agent containing:</p>
            <ol className="list-decimal pl-6 mt-2 space-y-1">
              <li>Identification of the material removed and the URL where it appeared before removal.</li>
              <li>A statement <strong className="text-foreground">under penalty of perjury</strong> that you have a good-faith belief the material was removed as a result of mistake or misidentification.</li>
              <li>Your name, address, and telephone number, and a statement that you consent to the jurisdiction of the federal district court for your address (or, if outside the United States, any judicial district in which HapiEats TV may be found), and that you will accept service of process from the person who filed the original notice or their agent.</li>
              <li>Your physical or electronic signature.</li>
            </ol>
            <p className="mt-2">We will forward your counter-notice to the original claimant. Unless they notify us within 10–14 business days that they have filed a court action seeking to restrain the alleged infringement, we may restore the removed material.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Repeat Infringers</h2>
            <p>We maintain a policy of terminating, in appropriate circumstances, the accounts of users who are repeat infringers. Strikes are recorded against an account for each valid, uncontested (or court-upheld) infringement notice. Accounts accumulating repeat strikes will be permanently terminated, including loss of monetization, unused Hapi Tokens per the <a href="/terms" className="text-primary hover:underline">Terms &amp; Conditions</a>, and streaming privileges. We may also terminate immediately for blatant infringement (e.g., restreaming another platform's or creator's content wholesale).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Designated Copyright Agent</h2>
            <p>Send notices and counter-notices to:</p>
            <address className="not-italic mt-2 border border-border rounded-lg p-4">
              <strong className="text-foreground">Copyright Agent</strong><br />
              [HapiEats TV, LLC — update with your registered legal entity and address]<br />
              [Agent name — register your designated agent with the U.S. Copyright Office at dmca.copyright.gov]<br />
              Email: <a href="mailto:support@hapieatstv.com" className="text-primary hover:underline">support@hapieatstv.com</a> (subject line: "DMCA Notice")
            </address>
            <p className="mt-2">Only copyright notices should be sent to this agent. For other issues — trademark complaints, privacy requests, or general support — contact <a href="mailto:support@hapieatstv.com" className="text-primary hover:underline">support@hapieatstv.com</a>.</p>
          </section>

          <p className="italic text-sm">This document is a template and should be reviewed by qualified legal counsel before relying on it.</p>

        </div>
      </main>
    </AppShell>
  )
}
