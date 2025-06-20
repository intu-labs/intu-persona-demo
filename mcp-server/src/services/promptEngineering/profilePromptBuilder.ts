import { BasePromptBuilder, PromptConfig } from './basePromptBuilder.js';
import { GeneratedPersona } from '../personaGenerator.js';

export class ProfilePromptBuilder extends BasePromptBuilder {
  constructor() {
    const config: PromptConfig = {
      baseStyle: 'editorial portrait photography, cinematic lighting, high-end professional quality',
      qualityTags: 'detailed face, sharp focus, 8k resolution, semi-realistic, clean, editorial quality',
      negativePrompt: 'blurry, low quality, distorted, multiple people, full body, amateur, snapshot'
    };
    super(config);
  }

  /**
   * Build a profile picture prompt for the given persona
   */
  buildPrompt(persona: GeneratedPersona): string {
    const elements = [
      this.getEnhancedCharacterDescription(persona),
      this.getDetailedPersonalityExpression(persona),
      this.getAccessoryDescription(persona),
      this.getEnvironmentalContext(persona),
      this.getStyleAndMood(persona),
      this.getPortraitSpecificElements()
    ];

    return this.combinePromptElements(elements);
  }

  /**
   * Get enhanced character description with age and professional context
   */
  private getEnhancedCharacterDescription(persona: GeneratedPersona): string {
    const baseDesc = this.getCharacterDescription(persona);
    const ageRange = this.getAgeRange(persona.education);
    const professionalContext = this.getProfessionalContext(persona);
    
    return `Portrait of ${baseDesc}, ${ageRange}, ${professionalContext}`;
  }

  /**
   * Get detailed personality expression with specific emotional descriptors
   */
  private getDetailedPersonalityExpression(persona: GeneratedPersona): string {
    const expressions: string[] = [];
    
    // Enhanced confidence mapping
    if (persona.confidence >= 5) {
      expressions.push('radiating confidence and authority', 'commanding presence', 'self-assured bearing');
    } else if (persona.confidence >= 4) {
      expressions.push('confident and poised', 'strong presence', 'assured demeanor');
    } else if (persona.confidence <= 2) {
      expressions.push('gentle confidence', 'approachable humility', 'thoughtful presence');
    } else {
      expressions.push('balanced confidence', 'natural ease');
    }

    // Enhanced charm mapping
    if (persona.charm >= 4) {
      expressions.push('irresistible charisma', 'magnetic warmth', 'engaging smile that disarms and invites');
    } else if (persona.charm <= 2) {
      expressions.push('subtle charm', 'quiet magnetism');
    } else {
      expressions.push('natural charm', 'warm approachability');
    }

    // Enhanced sarcasm/wit mapping
    if (persona.sarcasm >= 4) {
      expressions.push('playful spark behind the eyes', 'knowing wit', 'intelligent mischief');
    } else if (persona.sarcasm <= 2) {
      expressions.push('sincere earnestness', 'genuine warmth', 'honest expression');
    }

    return expressions.join(', ');
  }

  /**
   * Get environmental context based on persona traits
   */
  private getEnvironmentalContext(persona: GeneratedPersona): string {
    const contexts: string[] = [];
    
    // Base environment on region and sophistication
    if (persona.region === 'Western Europe' && persona.education >= 4) {
      contexts.push('softly lit European setting with architectural elements suggesting intellect and culture');
    } else if (persona.education >= 4) {
      contexts.push('sophisticated academic or professional environment');
    } else if (persona.charm >= 4) {
      contexts.push('warm, inviting setting with golden hour lighting');
    } else {
      contexts.push('clean, professional environment');
    }

    // Add lighting based on personality
    if (persona.charm >= 4 && persona.confidence >= 4) {
      contexts.push('bathed in warm, flattering light that enhances their magnetic presence');
    } else {
      contexts.push('with soft, professional lighting');
    }

    return contexts.join(', ');
  }

  /**
   * Get style and mood descriptors
   */
  private getStyleAndMood(persona: GeneratedPersona): string {
    const styles: string[] = [];
    
    // Overall vibe based on combined traits
    if (persona.confidence >= 4 && persona.charm >= 4 && persona.education >= 4) {
      styles.push('embodying the perfect blend of expertise and approachability');
      styles.push('someone who clearly belongs in the room and makes others feel welcome');
    } else if (persona.education >= 4) {
      styles.push('radiating intellectual authority with human warmth');
    } else if (persona.charm >= 4) {
      styles.push('naturally magnetic and instantly likeable');
    }

    // Morality-based character essence
    if (persona.morality >= 4) {
      styles.push('inspiring trust and curiosity');
      styles.push('the kind of person you would seek advice from');
    }

    // Visual style direction
    styles.push('think Vogue meets TED Talk aesthetic');
    
    return styles.join(', ');
  }

  /**
   * Get age range based on education level
   */
  private getAgeRange(education: number): string {
    if (education >= 5) {
      return 'in their late 30s to early 40s, at the peak of their expertise';
    } else if (education >= 4) {
      return 'in their early to mid-30s, established in their field';
    } else if (education >= 3) {
      return 'in their late 20s to early 30s, emerging professional';
    } else {
      return 'youthful and energetic';
    }
  }

  /**
   * Get professional context based on traits
   */
  private getProfessionalContext(persona: GeneratedPersona): string {
    if (persona.education >= 5 && persona.morality >= 4) {
      return 'a distinguished expert and thought leader';
    } else if (persona.education >= 4) {
      return 'a respected professional and subject matter expert';
    } else if (persona.charm >= 4) {
      return 'a charismatic and influential figure';
    } else {
      return 'a capable and engaging professional';
    }
  }

  /**
   * Get portrait-specific elements with enhanced composition
   */
  private getPortraitSpecificElements(): string {
    return 'head and shoulders composition, direct eye contact with the viewer, sophisticated depth of field, editorial composition';
  }

  /**
   * Generate multiple prompt variations for batch generation
   */
  generateVariations(persona: GeneratedPersona, count: number = 4): string[] {
    const basePrompt = this.buildPrompt(persona);
    const variations: string[] = [];

    for (let i = 0; i < count; i++) {
      const variationElements = this.getEnhancedVariationElements(i, persona);
      const variation = `${basePrompt}, ${variationElements}`;
      variations.push(variation);
    }

    return variations;
  }

  /**
   * Get enhanced variation elements with persona-aware adjustments
   */
  private getEnhancedVariationElements(index: number, persona: GeneratedPersona): string {
    const lightingVariations = [
      'soft golden hour lighting with warm highlights',
      'dramatic but flattering studio lighting with subtle shadows',
      'natural window light with soft diffusion',
      'professional editorial lighting with perfect balance'
    ];

    const compositionVariations = [
      'centered composition with perfect symmetry',
      'slight three-quarter angle for dynamic interest',
      'subtle side angle highlighting their best features',
      'straight-on composition emphasizing direct connection'
    ];

    const moodVariations = this.getMoodVariations(persona);

    const lightingIndex = index % lightingVariations.length;
    const compositionIndex = index % compositionVariations.length;
    const moodIndex = index % moodVariations.length;

    return `${lightingVariations[lightingIndex]}, ${compositionVariations[compositionIndex]}, ${moodVariations[moodIndex]}`;
  }

  /**
   * Get mood variations tailored to persona
   */
  private getMoodVariations(persona: GeneratedPersona): string[] {
    const baseMoods = [];
    
    if (persona.confidence >= 4) {
      baseMoods.push('radiating quiet confidence and authority');
    } else {
      baseMoods.push('displaying approachable confidence');
    }

    if (persona.charm >= 4) {
      baseMoods.push('with an irresistibly warm and engaging expression');
    } else {
      baseMoods.push('with a genuinely pleasant and welcoming demeanor');
    }

    if (persona.education >= 4) {
      baseMoods.push('conveying intellectual depth and wisdom');
    } else {
      baseMoods.push('showing thoughtful intelligence');
    }

    baseMoods.push('embodying the perfect balance of expertise and humanity');

    return baseMoods;
  }

  /**
   * Get LoRA recommendations based on persona
   */
  getLoRARecommendations(persona: GeneratedPersona): { name: string; strength: number } {
    // Default to retrograde-90s for now, but this can be expanded
    // based on persona attributes in the future
    return {
      name: 'retrograde-90s.safetensors',
      strength: 1.0
    };
  }

  /**
   * Get optimal dimensions for profile pictures
   */
  getOptimalDimensions(): { width: number; height: number } {
    return {
      width: 512,
      height: 768
    };
  }
} 