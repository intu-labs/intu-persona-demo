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

  // --- Seed Expertise (comprehensive, production-grade) ---
  const expertiseEntries = [
    {
      title: 'What is INTU?',
      content: `**INTU** is the unifying execution layer that connects AI & Blockchain technologies with your existing systems. INTU bridges, not replaces, your infrastructure, enabling preventative governance, verifiable operations, and secure integration across technological boundaries.\n\n- **Decentralized by Default**\n- **Universal Compatibility**\n- **Adaptive Policy Engine**\n- **Unified Identity Framework**\n- **Enhanced Data & Digital Assets**`,
      tags: ['overview', 'definition', 'business', 'technical'],
      links: [
        { label: 'Official Docs', url: 'https://docs.intu.xyz/' },
        { label: 'Brand Guide', url: 'https://docs.intu.xyz/' },
        { label: 'Product', url: 'https://intu.xyz/' },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "INTU's Core Features",
      content: `- **Unified Identity Framework**: Connects existing identity systems with distributed authorization controls for seamless and secure operation.\n- **Adaptive Policy Engine**: Advanced guardrails for security and compliance, with tamper-proof auditing.\n- **Cross-Platform Execution**: Consistent operations across AI, blockchain, and cloud.\n- **Enhanced Data & Digital Assets**: Unlocks the full value of data and digital assets while preserving control.`,
      tags: ['features', 'core', 'technical', 'business'],
      links: [
        { label: 'Product Overview', url: 'https://docs.intu.xyz/' },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "INTU Value Proposition (25/50/100 words)",
      content: `**25 words:**\nINTU connects systems through unified identity, adaptive policy enforcement, cross-platform execution, and enhanced data & digital assets—bridging AI and blockchain with existing infrastructure.\n\n**50 words:**\nINTU's execution & control layer bridges existing systems with emerging technologies through four core capabilities: unified identity framework, adaptive policy engine, cross-platform operations, and enhanced data & digital assets. Connect AI and blockchain with your infrastructure without disruption or replacement. Unlock new technologies, keep what works.\n\n**100 words:**\nINTU's execution & control layer connects your existing infrastructure with AI and blockchain through four integrated capabilities: A unified identity framework bridges authentication systems across environments. The adaptive policy engine provides preventative governance with access controls and usage policies. Cross-platform operations enable consistent execution across technology boundaries. Enhanced data & digital assets unlock the full value of information and assets while preserving control—enabling AI to securely utilize sensitive data and facilitate digital transactions. This comprehensive approach lets you implement advanced technologies without disruption, transforming policies into preventative controls while preserving existing investments.`,
      tags: ['value', 'messaging', 'business'],
      links: [
        { label: 'Brand Guide', url: 'https://docs.intu.xyz/' },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "INTU Elevator Pitches (15/30/60 seconds)",
      content: `**15-second:**\nINTU bridges AI and blockchain technologies with your existing systems, providing preventative governance before operations occur and tamper-proof records after execution.\n\n**30-second:**\nINTU provides the unifying execution layer that connects AI & Blockchain technologies with your existing systems. While most solutions monitor compliance after the fact, INTU enforces policies before execution, creating tamper-proof records of operations. This gives you verifiable evidence of compliance by design, not just documentation—critical as regulations around AI and data continue to tighten.\n\n**60-second:**\nINTU is the execution & control layer that bridges AI and blockchain technologies with your existing systems. Organizations face increasing pressure to ensure AI and digital operations comply with regulations, but most solutions only monitor violations after they occur. INTU transforms governance requirements into preventative policy enforcement that stops non-compliant operations before execution, while creating tamper-proof audit trails that satisfy regulators. By connecting with your existing infrastructure rather than replacing it, INTU enables you to implement advanced governance across technology boundaries without disruption. This approach reduces compliance risk, builds trust in critical operations, and provides the verifiable evidence regulators increasingly demand—all without replacing systems that already work.`,
      tags: ['pitch', 'messaging', 'business'],
      links: [
        { label: 'Brand Guide', url: 'https://docs.intu.xyz/' },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "INTU Use Cases",
      content: `- **AI Governance and Compliance**: Preventative governance for AI systems through policy execution nodes that enforce rules before operations occur, with audit trails providing verifiable evidence.\n- **Cross-Platform User Identity**: Seamless user experiences across Web2, Web3, and AI platforms with unified identity, distributed authorization, and user-controlled data policies.\n- **Regulated Applications**: Implement preventative governance for regulated industries with policy execution nodes that enforce rules before operations occur, providing verifiable evidence of compliance.\n- **Enhanced Data & AI Experiences**: Unlock the full value of data for AI systems while preserving user control—enable personalized experiences, secure digital asset transactions, and enterprise knowledge utilization with privacy boundaries and user-directed consent.`,
      tags: ['use cases', 'application', 'business', 'technical'],
      links: [
        { label: 'Use Cases', url: 'https://docs.intu.xyz/' },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "INTU Technical Differentiators",
      content: `- **Preventative vs. Reactive Governance**: INTU enforces policies before execution rather than simply monitoring after the fact.\n- **Distributed Security Without Central Authority**: Enhanced security through distribution rather than centralization.\n- **Cross-Technology Integration**: Bridges different technology domains without requiring replacement.\n- **Verifiable Operations with Tamper-Proof Evidence**: Provides cryptographically verifiable evidence of operations and compliance.\n- **Enhanced Data & Digital Asset Utilization**: Unlocks the full value of data and digital assets while preserving control through user-directed boundaries.`,
      tags: ['technical', 'differentiators', 'security'],
      links: [
        { label: 'Technical Overview', url: 'https://docs.intu.xyz/' },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "INTU Integration Patterns",
      content: `- **WebKit**: Rapid social login → Web3 functionality\n- **Web SDK**: Customized frontend implementations\n- **Node SDK**: Backend services, co-signers, policy enforcement\n- **Enterprise Infrastructure**: Hybrid deployment, private channels, on-premises\n- **AI Integration**: Connecting AI systems with governance\n- **Pilot Implementation**: Controlled scope for validation`,
      tags: ['integration', 'developer', 'technical'],
      links: [
        { label: 'SDK Reference', url: 'https://docs.intu.xyz/build/sdk/' },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "INTU Terminology (Preferred & Discouraged)",
      content: `| Discouraged Term | Preferred Alternative |\n|------------------|----------------------|\n| MPC protocol | Distributed authority framework |\n| Co-signers | Policy execution nodes |\n| Distributed ledger technology | Blockchain |\n| Blockchain governance | Execution governance |\n| Crypto custody | Digital asset protection |\n| Multi-sig | Multi-party authorization |\n| Wallet infrastructure | Asset control systems |\n| On-chain data | Tamper-proof records |\n| Blockchain alternative | Infrastructure bridge |\n| Permissionless system | Configurable governance |\n| Decentralized platform | Hybrid trust architecture |\n| Replacement system | Complementary execution layer |`,
      tags: ['terminology', 'branding', 'technical'],
      links: [
        { label: 'Brand Guide', url: 'https://docs.intu.xyz/' },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "INTU Brand Taglines & Hero Statements",
      content: `- **Primary Tagline:** UNLOCK NEW TECHNOLOGIES, KEEP WHAT WORKS.\n- **Product Description Tagline:** INTU provides the *unifying execution layer* that connects AI & Blockchain technologies with your existing systems. Bridge, don't replace.\n- **Compliance Tagline:** Data needs governance. AI needs boundaries. Operations need trust. INTU delivers all three.\n- **Hero Statement:** UNLOCK NEW TECHNOLOGIES, KEEP WHAT WORKS.\n- **Brief Description:** The unifying execution bridge that connects AI and blockchain with your existing infrastructure.`,
      tags: ['branding', 'messaging'],
      links: [
        { label: 'Brand Guide', url: 'https://docs.intu.xyz/' },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    // ... (more entries can be added for use cases, technical implementation, compliance, developer guides, audience segments, pain points, solution statements, visual language, etc.)
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