import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { config } from '../config.js';
import Stripe from 'stripe';
export default async function (req) {
    if (!config.donationsEnabled)
        return Response.json({ error: 'Donations are disabled' }, { status: 404 });
    if (!config.stripeSecret)
        return Response.json({ error: 'Donations are not configured' }, { status: 503 });
    const stripe = new Stripe(config.stripeSecret, { apiVersion: '2024-06-20' });
    const platform = createPlatformClientFromRequest(req);
    const user = await platform.auth.me();
    if (!user)
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const { amount_pence = 200, success_url, cancel_url } = body;
    if (amount_pence < 50) {
        return Response.json({ error: 'Minimum donation is 50p' }, { status: 400 });
    }
    // Create pending donation record
    const donation = await platform.asServiceRole.entities.Donation.create({
        user_email: user.email,
        user_id: user.id,
        amount_pence,
        status: 'pending'
    });
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
                price_data: {
                    currency: 'gbp',
                    product_data: {
                        name: 'Open Domains Donation',
                        description: 'Support Open Domains and unlock NS record requests (£2+ total)',
                    },
                    unit_amount: amount_pence,
                },
                quantity: 1,
            }],
        mode: 'payment',
        customer_email: user.email,
        metadata: {
            donation_id: donation.id,
            user_id: user.id,
            user_email: user.email,
        },
        success_url: success_url || `${config.appUrl}/settings?donation=success`,
        cancel_url: cancel_url || `${config.appUrl}/settings?donation=cancelled`,
    });
    // Save session ID
    await platform.asServiceRole.entities.Donation.update(donation.id, {
        stripe_session_id: session.id
    });
    await platform.asServiceRole.entities.AuditLog.create({
        actor_email: user.email, actor_role: user.role || 'user',
        action: 'donation_initiated', entity_type: 'Donation', entity_id: donation.id,
        description: `Donation of £${(amount_pence / 100).toFixed(2)} initiated`
    });
    return Response.json({ url: session.url, session_id: session.id });
}
