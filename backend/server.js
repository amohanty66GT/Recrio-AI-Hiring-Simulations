import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import multer from 'multer';
import fs from 'fs';
import Tesseract from 'tesseract.js';

dotenv.config();
console.log("🔑 Loaded API Key:", process.env.OPENAI_API_KEY);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});


const app = express();
app.use(cors());
app.use(express.json());

app.get('/ping', (req, res) => {
  res.send('pong');
});
// Route for feedback
app.post('/review', async (req, res) => {
  const { careerCardText } = req.body;

  if (!careerCardText) {
    return res.status(400).json({ error: 'No career card text provided' });
  }

  const prompt = `
You are an expert career coach. Given the text of a career card, provide the following:

1. Strengths
2. Weaknesses
3. Suggestions for improvement
4. Overall Rating (1–10)

Be honest, detailed, and professional.

Career Card:
${careerCardText}
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a helpful, professional career coach." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7
    });

    res.json({ feedback: completion.choices[0].message.content });
} catch (error) {
  console.error("❌ OpenAI error:", error?.response?.data || error.message || error);
  res.status(500).json({ error: 'Error generating feedback', details: error?.message });
}

});
const simulationSessions = {}; // In-memory store for simplicity

app.post('/simulate', async (req, res) => {
  const { careerCardText, role } = req.body;

  const systemPrompt = `
You are conducting a high-pressure simulation interview for a candidate applying for the role of ${role}. The simulation should mimic real-world, high-stakes scenarios where collaboration, decision-making, and adaptability are tested. Do not assist the candidate in any way.

Score them at the end based on:
1. Business impact
2. Technical accuracy
3. Trade-off analysis
4. Constraint management
5. Communication skills

The candidate's resume:
${careerCardText}

Start with a short welcome and then give them the first scenario.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Hi, I’m ready to begin.' }  // You can use a generic intro trigger here
      ],
      temperature: 0.7
    });

    const firstQuestion = completion.choices[0].message.content;
    res.json({ conversation: [{ role: 'ai', message: firstQuestion }] });
  } catch (error) {
    console.error('❌ Simulation start error:', error);
    res.status(500).json({ error: 'Failed to start simulation.' });
  }
});


app.post('/simulate/continue', async (req, res) => {
  const { conversationHistory, userMessage, role, careerCard, scenarioCount } = req.body;

  try {
    const MAX_SCENARIOS = 5;

    let prompt = '';

    if (scenarioCount >= MAX_SCENARIOS) {
      prompt = `The candidate has completed the simulation. Based on the entire conversation, give a final evaluation. Score them on:

1. Business impact  
2. Technical accuracy  
3. Trade-off analysis  
4. Constraint management  
5. Communication skills

Give a score out of 10 for each, and justify your reasoning. Be strict and professional.`;
    } else {
      prompt = `Continue the simulation. The candidate just replied with: "${userMessage}". Ask a new, realistic scenario based on the job role: ${role}. Do not give hints.`;
    }

    const messages = [
      { role: 'system', content: `You are a strict simulation interviewer assessing a candidate for the role of ${role}.` },
      ...conversationHistory.map(entry => ({
        role: entry.sender === 'user' ? 'user' : 'assistant',
        content: entry.message
      })),
      { role: 'user', content: prompt }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.7
    });

    const aiResponse = completion.choices[0].message.content;
    res.json({ response: aiResponse });
  } catch (error) {
    console.error('❌ Simulation continue error:', error);
    res.status(500).json({ error: 'Failed to continue simulation.' });
  }
});


// Optional: add /upload route for PDF/image if needed

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
