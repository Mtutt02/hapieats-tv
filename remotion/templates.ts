export type TemplateId = "blank" | "recipe" | "review" | "top5";

export type TemplateConfig = {
  id: TemplateId;
  label: string;
  description: string;
  icon: string;
  defaultDuration: number;
  fields: TemplateField[];
};

export type TemplateField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "stars" | "list";
  placeholder?: string;
};

export const TEMPLATES: Record<TemplateId, TemplateConfig> = {
  blank: {
    id: "blank",
    label: "Blank Canvas",
    description: "Start from scratch with full control",
    icon: "🎨",
    defaultDuration: 60,
    fields: [],
  },
  recipe: {
    id: "recipe",
    label: "Recipe Video",
    description: "Ingredients, steps, and final dish reveal",
    icon: "🍳",
    defaultDuration: 90,
    fields: [
      { key: "dishName", label: "Dish Name", type: "text", placeholder: "e.g. Garlic Butter Shrimp" },
      { key: "ingredients", label: "Ingredients", type: "textarea", placeholder: "List ingredients (one per line)" },
      { key: "prepTime", label: "Prep Time (min)", type: "number", placeholder: "15" },
      { key: "cookTime", label: "Cook Time (min)", type: "number", placeholder: "25" },
      { key: "difficulty", label: "Difficulty", type: "text", placeholder: "Easy / Medium / Hard" },
    ],
  },
  review: {
    id: "review",
    label: "Food Review",
    description: "Rating, verdict, and side-by-side comparisons",
    icon: "⭐",
    defaultDuration: 75,
    fields: [
      { key: "title", label: "Review Title", type: "text", placeholder: "e.g. Birria Tacos at Taqueria" },
      { key: "rating", label: "Rating (out of 5)", type: "stars", placeholder: "4" },
      { key: "pros", label: "What's Good", type: "textarea", placeholder: "Flavor, texture, price..." },
      { key: "cons", label: "What's Not", type: "textarea", placeholder: "Portion size, wait time..." },
      { key: "verdict", label: "Verdict", type: "text", placeholder: "e.g. Worth the hype!" },
    ],
  },
  top5: {
    id: "top5",
    label: "Top 5 List",
    description: "Ranked countdown with reveal animations",
    icon: "🏆",
    defaultDuration: 90,
    fields: [
      { key: "listTitle", label: "List Title", type: "text", placeholder: "e.g. Best Ramen in NYC" },
      { key: "items", label: "Ranked Items", type: "list", placeholder: "List items 1-5 (one per line)" },
      { key: "honorableMention", label: "Honorable Mention", type: "text", placeholder: "(optional)" },
    ],
  },
};
