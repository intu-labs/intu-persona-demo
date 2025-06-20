import { connectDatabase, disconnectDatabase } from './database.js';
import Persona from '../models/persona.js';
import Expertise from '../models/expertise.js';
import NFTCache from '../models/nftCache.js'; // Ensure model is loaded

async function seed() {
  await connectDatabase();

  // --- Seed Persona ---
  const personaData = {
    name: 'Dr. Indigo Bridge',
    gender: 'Non-binary',
    confidence: 5,
    sarcasm: 1,
    charm: 4,
    morality: 5,
    appearance: 'Elegant',
    region: 'Western Europe',
    education: 5,
    accessory: 'Gradient Silk Scarf',
    systemPrompt: `You are Dr. Indigo Bridge, the INTU expert agent. You are knowledgeable, approachable, and always helpful—like a favorite college professor who you'd enjoy having a drink with. You answer questions about INTU's technology, brand, and integration, always using clear, accessible language. When asked about INTU, you use the latest product messaging and terminology, and you proactively offer to use available MCP tools for demos or technical queries. You never speculate; if you don't know, you say so and offer to find out. You are always on-brand, positive, and precise.`,
    type: 'neutral',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const personaExists = await Persona.findOne({ name: personaData.name, type: 'neutral' });
  if (!personaExists) {
    await Persona.create(personaData);
    console.log('Seeded neutral persona: Dr. Indigo Bridge');
  } else {
    console.log('Neutral persona already exists, skipping.');
  }

  // --- Seed Expertise (structure only, will expand with full content after review) ---
  const expertiseEntries = [
    {
      title: 'What is INTU?',
      content: 'INTU is the unifying execution layer that connects AI & Blockchain technologies with your existing systems. Bridge, don\'t replace. (Full content to be expanded.)',
      tags: ['overview', 'definition', 'business'],
      links: [
        { label: 'Official Docs', url: 'https://docs.intu.xyz/' },
        { label: 'Brand Guide', url: 'https://docs.intu.xyz/' },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: 'INTU\'s Core Features',
      content: '- Unified Identity\n- Adaptive Policy Engine\n- Cross-Platform Execution\n- Enhanced Data & Digital Assets (Full content to be expanded.)',
      tags: ['features', 'core', 'technical'],
      links: [
        { label: 'Product Overview', url: 'https://docs.intu.xyz/' },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    // ... (more entries to be added after review)
  ];

  for (const entry of expertiseEntries) {
    const exists = await Expertise.findOne({ title: entry.title });
    if (!exists) {
      await Expertise.create(entry);
      console.log(`Seeded expertise: ${entry.title}`);
    } else {
      console.log(`Expertise already exists: ${entry.title}, skipping.`);
    }
  }

  // --- NFTCache collection is ready for use as a temporary IPFS cache ---
  // No initial data seeded here, but model is loaded for dev/testing.
  // MinIO is used for image storage and caching before IPFS/NFT minting.

  await disconnectDatabase();
  console.log('Seeding complete.');
}

seed().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
}); 