import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { config } from '../config.js';
import Stripe from 'stripe';
const NS_UNLOCK_THRESHOLD_PENCE = 200; // £2.00
async function sendDiscordNotification(platform, eventType, title, description, fields) {
    try {
        const settings = await platform.asServiceRole.entities.PlatformSettings.filter({ key: 'discord_webhook_url' });
        const webhookUrl = settings?.[0]?.value;
        if (!webhookUrl)
            return;
        const COLORS = { donation: 0x10b981, ns_unlock: 0x6366f1 };
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                        title, description,
                        color: COLORS[eventType] || 0x10b981,
                        fields: fields.map(f => ({ name: f.name, value: String(f.value || '—'), inline: true })),
                        timestamp: new Date().toISOString(),
                        footer: { text: 'Open Domains Platform' }
                    }]
            })
        });
    }
    catch (_) { }
}
export default async function (req) {
    if (!config.donationsEnabled)
        return Response.json({ error: 'Donations are disabled' }, { status: 404 });
    if (!config.stripeSecret || !config.stripeWebhookSecret)
        return Response.json({ error: 'Stripe webhook is not configured' }, { status: 503 });
    const stripe = new Stripe(config.stripeSecret, { apiVersion: '2024-06-20' });
    const platform = createPlatformClientFromRequest(req);
    const signature = req.headers.get('stripe-signature');
    const body = await req.text();
    let event;
    try {
        event = await stripe.webhooks.constructEventAsync(body, signature, config.stripeWebhookSecret);
    }
    catch (err) {
        return Response.json({ error: `Webhook error: ${err.message}` }, { status: 400 });
    }
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { donation_id, user_id, user_email } = session.metadata || {};
        if (!donation_id)
            return Response.json({ received: true });
        // Update donation to succeeded
        await platform.asServiceRole.entities.Donation.update(donation_id, {
            status: 'succeeded',
            stripe_payment_intent_id: session.payment_intent
        });
        // Calc total successful donations for this user
        const allDonations = await platform.asServiceRole.entities.Donation.filter({
            user_email, status: 'succeeded'
        });
        const totalPence = allDonations.reduce((sum, d) => sum + (d.amount_pence || 0), 0);
        // Check if NS unlock threshold reached
        let nsUnlockGranted = false;
        if (totalPence >= NS_UNLOCK_THRESHOLD_PENCE) {
            // Update all their donations to reflect unlock
            await platform.asServiceRole.entities.Donation.update(donation_id, { ns_unlock_granted: true });
            // Update user record
            await platform.asServiceRole.entities.User.update(user_id, { ns_unlocked: true });
            nsUnlockGranted = true;
        }
        const amountGbp = (session.amount_total / 100).toFixed(2);
        const totalGbp = (totalPence / 100).toFixed(2);
        await platform.asServiceRole.entities.AuditLog.create({
            actor_email: user_email || 'stripe', actor_role: 'user',
            action: 'donation_succeeded', entity_type: 'Donation', entity_id: donation_id,
            description: `Donation of £${amountGbp} received. Total: £${totalGbp}. NS unlock: ${nsUnlockGranted}`
        });
        await sendDiscordNotification(platform, 'donation', nsUnlockGranted ? '💎 Donation + NS Unlocked!' : '💰 Donation Received', nsUnlockGranted ? 'A user crossed the £2 threshold and unlocked NS records.' : 'A new donation was received.', [
            { name: 'User', value: user_email },
            { name: 'Amount', value: `£${amountGbp}` },
            { name: 'Total Donated', value: `£${totalGbp}` },
            { name: 'NS Unlocked', value: nsUnlockGranted ? 'Yes ✅' : 'No' }
        ]);
    }
    return Response.json({ received: true });
}
