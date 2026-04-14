import { config } from './config.js';

const TOGETHER_API_URL = 'https://api.together.xyz/v1/chat/completions';
const MODEL = 'meta-llama/Llama-3.3-70B-Instruct-Turbo';

async function callTogether(prompt) {
  if (!config.togetherApiKey) {
    throw new Error('TOGETHER_API_KEY tanımlı değil.');
  }

  const response = await fetch(TOGETHER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.togetherApiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 220,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content:
            'Sen bir sosyal medya analisti asistanısın. Türkçe, kısa ve içgörülü yorumlar yaz. Maksimum 3 cümle.'
        },
        { role: 'user', content: prompt }
      ]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    const msg = data?.error?.message || 'Together AI isteği başarısız oldu.';
    throw new Error(msg);
  }

  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('AI yanıt boş döndü.');
  return text;
}

export async function generateInstagramComment({
  username,
  fullName,
  isPrivate,
  isVerified,
  mediaCount,
  followersCount,
  followsCount,
  profilePower,
  trustScore
}) {
  const prompt =
    `Instagram profili analizi:
Kullanıcı adı: @${username}
Ad: ${fullName || '-'}
Takipçi: ${followersCount ?? '?'}, Takip: ${followsCount ?? '?'}
Gönderi: ${mediaCount ?? '?'}
Gizli hesap: ${isPrivate ? 'Evet' : 'Hayır'}
Doğrulanmış: ${isVerified ? 'Evet' : 'Hayır'}
Profil güç skoru: ${profilePower ?? '?'}/100
Güven skoru: ${trustScore ?? '?'}/100

Bu profile kısa, dürüst ve içgörülü bir Türkçe yorum yaz. Maksimum 3 cümle.`;

  return callTogether(prompt);
}

export async function generateWhatsAppComment({
  contactName,
  totalMessages,
  person1Count,
  person2Count,
  balanceScore,
  avgResponseMinutes,
  peakHour,
  initiatedByPerson1,
  initiatedByPerson2
}) {
  const totalInit = (initiatedByPerson1 ?? 0) + (initiatedByPerson2 ?? 0);
  const initText =
    totalInit === 0
      ? 'Başlatma verisi yok'
      : `${contactName} ${initiatedByPerson1} kez, sen ${initiatedByPerson2} kez başlattın`;

  const responseText =
    avgResponseMinutes < 1
      ? '1 dakikadan az'
      : avgResponseMinutes < 60
      ? `${Math.round(avgResponseMinutes)} dakika`
      : `${(avgResponseMinutes / 60).toFixed(1)} saat`;

  const prompt =
    `WhatsApp sohbet analizi:
Kişi: ${contactName}
Toplam mesaj: ${totalMessages}
${contactName}: ${person1Count} mesaj, Sen: ${person2Count} mesaj
Denge puanı: ${balanceScore}/100
Ortalama yanıt süresi: ${responseText}
En yoğun saat: ${peakHour}:00
Konuşma başlatma: ${initText}

Bu sohbet dinamiğine dair kısa, dürüst ve içgörülü bir Türkçe yorum yaz. Maksimum 3 cümle.`;

  return callTogether(prompt);
}
