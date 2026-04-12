import { HomePageClient } from "./home-page-loader";

/**
 * 中身はクライアント専用（TensorFlow / MediaPipe / seeso を SSR しない）。
 */
export default function HomePage() {
  return <HomePageClient />;
}
