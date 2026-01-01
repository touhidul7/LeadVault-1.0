import { NextResponse } from 'next/server';

const SMS_API_BASE = 'https://api.mimsms.com';
const SMS_USERNAME = process.env.SMS_USERNAME || '';
const SMS_API_KEY = process.env.SMS_API_KEY || '';

export async function GET() {
  try {
    if (!SMS_USERNAME || !SMS_API_KEY) {
      return NextResponse.json(
        { error: 'SMS credentials not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(
      `${SMS_API_BASE}/api/SmsSending/balanceCheck`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          UserName: SMS_USERNAME,
          Apikey: SMS_API_KEY,
        }),
      }
    );

    const data = await response.json();

    if (data.statusCode !== '200') {
      console.error('SMS balance check error:', data);
      return NextResponse.json(
        { error: data.responseResult || 'Failed to fetch SMS balance' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      balance: data.responseResult || '0.00',
      currency: 'BDT',
    });
  } catch (error: any) {
    console.error('SMS balance API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch SMS balance' },
      { status: 500 }
    );
  }
}
