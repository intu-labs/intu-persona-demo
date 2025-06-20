import { GeneratedPersona } from '../personaGenerator.js';

export interface PromptConfig {
  baseStyle: string;
  qualityTags: string;
  negativePrompt?: string;
}

export abstract class BasePromptBuilder {
  protected config: PromptConfig;

  constructor(config: PromptConfig) {
    this.config = config;
  }

  /**
   * Build a complete prompt for the given persona
   */
  abstract buildPrompt(persona: GeneratedPersona): string;

  /**
   * Get character description from persona
   */
  protected getCharacterDescription(persona: GeneratedPersona): string {
    const genderDesc = this.getGenderDescription(persona.gender);
    const regionDesc = this.getRegionDescription(persona.region);
    const appearanceDesc = this.getAppearanceDescription(persona.appearance);
    
    return `${genderDesc} ${regionDesc} with ${appearanceDesc} style`;
  }

  /**
   * Get personality-based expression and pose
   */
  protected getPersonalityExpression(persona: GeneratedPersona): string {
    const expressions: string[] = [];
    
    // Confidence affects posture and eye contact
    if (persona.confidence >= 4) {
      expressions.push('confident posture', 'direct gaze', 'strong presence');
    } else if (persona.confidence <= 2) {
      expressions.push('modest posture', 'gentle expression', 'humble demeanor');
    } else {
      expressions.push('balanced posture', 'natural expression');
    }

    // Charm affects facial expression and warmth
    if (persona.charm >= 4) {
      expressions.push('warm smile', 'charismatic expression', 'engaging eyes');
    } else if (persona.charm <= 2) {
      expressions.push('reserved expression', 'subtle features');
    } else {
      expressions.push('pleasant expression');
    }

    // Sarcasm affects subtle facial cues
    if (persona.sarcasm >= 4) {
      expressions.push('slight smirk', 'knowing look', 'witty expression');
    } else if (persona.sarcasm <= 2) {
      expressions.push('sincere expression', 'earnest look');
    }

    return expressions.join(', ');
  }

  /**
   * Get accessory description
   */
  protected getAccessoryDescription(persona: GeneratedPersona): string {
    return `wearing ${persona.accessory}`;
  }

  /**
   * Get education-based sophistication level
   */
  protected getSophisticationLevel(persona: GeneratedPersona): string {
    if (persona.education >= 4) {
      return 'sophisticated, refined, intellectual appearance';
    } else if (persona.education <= 2) {
      return 'down-to-earth, practical appearance';
    } else {
      return 'well-presented, approachable appearance';
    }
  }

  /**
   * Get morality-based character traits
   */
  protected getMoralityTraits(persona: GeneratedPersona): string {
    if (persona.morality >= 4) {
      return 'noble bearing, trustworthy appearance, principled demeanor';
    } else if (persona.morality <= 2) {
      return 'edgy appearance, rebellious style, unconventional look';
    } else {
      return 'balanced character, relatable appearance';
    }
  }

  /**
   * Map gender to description
   */
  private getGenderDescription(gender: string): string {
    const genderMap: Record<string, string> = {
      'Male': 'distinguished man',
      'Female': 'striking woman',
      'Non-binary': 'elegant non-binary individual with fluid, inclusive presentation',
      'Alien': 'otherworldly being'
    };
    return genderMap[gender] || 'distinguished person';
  }

  /**
   * Map region to cultural/ethnic description
   */
  private getRegionDescription(region: string): string {
    const regionMap: Record<string, string> = {
      'North America': 'of North American heritage',
      'Latin America': 'of Latin American heritage',
      'Western Europe': 'of Western European heritage',
      'Eastern Europe': 'of Eastern European heritage',
      'Indian': 'of Indian heritage',
      'Arab': 'of Middle Eastern heritage',
      'Africa': 'of African heritage',
      'Asian': 'of East Asian heritage',
      'Pacific Islander/South East Asia': 'of Pacific Islander heritage',
      'Moon': 'of lunar origin'
    };
    return regionMap[region] || 'of diverse heritage';
  }

  /**
   * Map appearance to style description
   */
  private getAppearanceDescription(appearance: string): string {
    const appearanceMap: Record<string, string> = {
      'Elegant': 'elegant, refined',
      'Humble': 'humble, understated',
      'Militant': 'strong, disciplined',
      'Bohemian': 'bohemian, artistic',
      'Fashionable': 'fashionable, trendy',
      'Homeless': 'rugged, weathered',
      'Hipster': 'hipster, alternative',
      'Athletic': 'athletic, fit'
    };
    return appearanceMap[appearance] || 'distinctive';
  }

  /**
   * Combine all elements into a cohesive prompt
   */
  protected combinePromptElements(elements: string[]): string {
    const filteredElements = elements.filter(el => el && el.trim().length > 0);
    return `${this.config.baseStyle}, ${filteredElements.join(', ')}, ${this.config.qualityTags}`;
  }

  /**
   * Get random seed for variation
   */
  protected getRandomSeed(): number {
    return Math.floor(Math.random() * 1000000);
  }
} 