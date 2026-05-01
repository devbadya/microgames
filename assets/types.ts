/** Game manifest entry (`public/games/games.json`) */
export type Game = {
  slug: string;
  title: string;
  title_de?: string;
  description: string;
  description_de?: string;
  minutes: number;
  tags: string[];
  thumbnail: string;
};
