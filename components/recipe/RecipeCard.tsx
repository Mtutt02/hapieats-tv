import { Clock, Users, ChefHat, Flame } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface RecipeIngredient {
  amount: string
  unit: string
  item: string
}

export interface RecipeStep {
  step: number
  instruction: string
}

export interface RecipeCardData {
  id: string
  video_id: string
  title: string
  description?: string | null
  prep_time_minutes?: number | null
  cook_time_minutes?: number | null
  servings?: number | null
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | null
  cuisine_type?: string | null
  dietary_tags?: string[] | null
  ingredients?: RecipeIngredient[] | null
  steps?: RecipeStep[] | null
  calories_per_serving?: number | null
}

interface RecipeCardProps {
  recipe: RecipeCardData
}

const difficultyConfig = {
  beginner: { label: 'Beginner', className: 'bg-green-500/15 text-green-400 border-green-500/30' },
  intermediate: { label: 'Intermediate', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  advanced: { label: 'Advanced', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
}

const dietaryColors: Record<string, string> = {
  vegan: 'bg-green-500/10 text-green-400 border-green-500/25',
  vegetarian: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  'gluten-free': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/25',
  'dairy-free': 'bg-blue-500/10 text-blue-400 border-blue-500/25',
  keto: 'bg-purple-500/10 text-purple-400 border-purple-500/25',
  paleo: 'bg-orange-500/10 text-orange-400 border-orange-500/25',
}

export default function RecipeCard({ recipe }: RecipeCardProps) {
  const totalTime = (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0)
  const difficulty = recipe.difficulty ? difficultyConfig[recipe.difficulty] : null
  const ingredients = recipe.ingredients as RecipeIngredient[] | null
  const steps = recipe.steps as RecipeStep[] | null

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header bar */}
      <div className="px-5 py-4 border-b border-border bg-primary/5 flex items-center gap-2">
        <ChefHat className="h-5 w-5 text-primary flex-shrink-0" />
        <h2 className="font-bold text-base text-foreground">{recipe.title}</h2>
        {recipe.cuisine_type && (
          <span className="ml-auto text-xs font-medium text-muted-foreground border border-border rounded-full px-2.5 py-0.5">
            {recipe.cuisine_type}
          </span>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Description */}
        {recipe.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{recipe.description}</p>
        )}

        {/* Stats row */}
        <div className="flex flex-wrap gap-3">
          {recipe.prep_time_minutes != null && (
            <div className="flex items-center gap-1.5 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Prep:</span>
              <span className="font-semibold">{recipe.prep_time_minutes}m</span>
            </div>
          )}
          {recipe.cook_time_minutes != null && (
            <div className="flex items-center gap-1.5 text-sm">
              <Flame className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Cook:</span>
              <span className="font-semibold">{recipe.cook_time_minutes}m</span>
            </div>
          )}
          {totalTime > 0 && (recipe.prep_time_minutes != null && recipe.cook_time_minutes != null) && (
            <div className="flex items-center gap-1.5 text-sm">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Total:</span>
              <span className="font-semibold text-primary">{totalTime}m</span>
            </div>
          )}
          {recipe.servings != null && (
            <div className="flex items-center gap-1.5 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Serves:</span>
              <span className="font-semibold">{recipe.servings}</span>
            </div>
          )}
          {recipe.calories_per_serving != null && (
            <div className="text-sm">
              <span className="text-muted-foreground">Cal/serving: </span>
              <span className="font-semibold">{recipe.calories_per_serving}</span>
            </div>
          )}
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-2">
          {difficulty && (
            <span className={cn(
              'inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border',
              difficulty.className
            )}>
              <ChefHat className="h-3 w-3" />
              {difficulty.label}
            </span>
          )}
          {recipe.dietary_tags?.map((tag) => (
            <span
              key={tag}
              className={cn(
                'text-xs font-medium px-2.5 py-1 rounded-full border capitalize',
                dietaryColors[tag.toLowerCase()] ?? 'bg-muted text-muted-foreground border-border'
              )}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Two-column layout for ingredients + steps on wider screens */}
        {(ingredients?.length || steps?.length) ? (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 pt-1">
            {/* Ingredients */}
            {ingredients && ingredients.length > 0 && (
              <div className="md:col-span-2">
                <h3 className="text-sm font-bold mb-3 text-foreground uppercase tracking-wide">
                  Ingredients
                </h3>
                <ul className="space-y-2">
                  {ingredients.map((ing, i) => (
                    <li key={i} className="flex items-baseline gap-2 text-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                      <span>
                        {ing.amount && <strong>{ing.amount} </strong>}
                        {ing.unit && <span className="text-muted-foreground">{ing.unit} </span>}
                        {ing.item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Steps */}
            {steps && steps.length > 0 && (
              <div className={ingredients && ingredients.length > 0 ? 'md:col-span-3' : 'md:col-span-5'}>
                <h3 className="text-sm font-bold mb-3 text-foreground uppercase tracking-wide">
                  Instructions
                </h3>
                <ol className="space-y-3">
                  {steps.map((s, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">
                        {s.step ?? i + 1}
                      </span>
                      <span className="text-muted-foreground leading-relaxed pt-0.5">{s.instruction}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
