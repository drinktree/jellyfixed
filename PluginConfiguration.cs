using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.CustomTheme
{
    /// <summary>
    /// All theme settings. Styling options are consumed by <see cref="CssGenerator"/>;
    /// the Netflix feature toggles (hero, genre rows, nav tabs, previews, …) gate the
    /// injected headerButton.js at runtime, and the injection options control
    /// <see cref="EntryPoint"/> / <see cref="IndexInjectionMiddleware"/>.
    /// </summary>
    public class PluginConfiguration : BasePluginConfiguration
    {
        // --- Colors ---
        public string AccentColor { get; set; } = "#E50914";
        public string BgColor { get; set; } = "#141414";
        public string TextColor { get; set; } = "#FFFFFF";
        public string MutedColor { get; set; } = "#B3B3B3";

        /// <summary>Progress bar colour: accent, red, green, blue, purple.</summary>
        public string ProgressColor { get; set; } = "accent";

        /// <summary>Seasonal preset that overrides the four colours above: default, christmas, halloween, summer, ocean.</summary>
        public string SeasonalTheme { get; set; } = "default";

        // --- Logo ---
        /// <summary>jellyfin, netflix, letter, custom, none.</summary>
        public string LogoStyle { get; set; } = "netflix";
        public string LogoLetter { get; set; } = "N";
        public string CustomLogoUrl { get; set; } = string.Empty;

        // --- Header ---
        public bool HeaderBlur { get; set; }

        // --- Element visibility ---
        public bool ShowBadges { get; set; } = true;
        public bool ShowPlayed { get; set; } = true;
        public bool ShowBackdrop { get; set; } = true;
        public bool RoundCast { get; set; } = true;
        public bool ShowDescription { get; set; } = true;
        public bool ShowTags { get; set; } = true;
        public bool ShowExternalLinks { get; set; } = true;
        public bool ShowSimilar { get; set; } = true;
        public bool SpoilerMode { get; set; }

        // --- Detail page buttons ---
        public bool ShowBtnWatched { get; set; } = true;
        public bool ShowBtnFavorite { get; set; } = true;
        public bool ShowBtnMore { get; set; } = true;

        // --- Layout ---
        /// <summary>One of the keys in <see cref="CssGenerator"/>'s font map.</summary>
        public string FontFamily { get; set; } = "inter";

        /// <summary>small, normal, large.</summary>
        public string FontSize { get; set; } = "normal";

        public int CardRadius { get; set; } = 4;

        /// <summary>small, normal, large.</summary>
        public string CardSize { get; set; } = "normal";

        /// <summary>mixed, portrait, landscape.</summary>
        public string CardStyle { get; set; } = "mixed";

        public bool CardHoverScale { get; set; } = true;
        public bool CardInfoOverlay { get; set; } = true;

        /// <summary>light, medium, heavy.</summary>
        public string GradientStrength { get; set; } = "medium";

        /// <summary>small, large, huge.</summary>
        public string TitleSize { get; set; } = "large";

        /// <summary>fast, normal, slow, off.</summary>
        public string AnimSpeed { get; set; } = "normal";

        public bool SidebarCompact { get; set; }
        public bool AmbientGlow { get; set; }

        // --- Netflix features (need the injected script) ---
        /// <summary>
        /// Rotating auto-play hero billboard carousel on the home page (own implementation —
        /// replaces the Jellyfin Media Bar plugin). On by default so the Netflix look is
        /// self-contained out of the box.
        /// </summary>
        public bool HeroBillboard { get; set; } = true;

        /// <summary>Build curated genre rows on the home page (replaces the Home Screen Sections plugin).</summary>
        public bool GenreRows { get; set; } = true;

        /// <summary>Genres never shown as home rows (comma-separated, case-insensitive).</summary>
        public string GenreRowsExclude { get; set; } = "Documentary, Dokumentarfilm, Dokumentation";

        /// <summary>"My List" home row built from favourites — the destination for every + button.</summary>
        public bool MyListRow { get; set; } = true;

        /// <summary>"New Releases" home row (recently added), with a red NEW flag on fresh artwork.</summary>
        public bool NewReleasesRow { get; set; } = true;

        /// <summary>"Watch It Again" home row of finished titles.</summary>
        public bool WatchAgainRow { get; set; } = true;

        /// <summary>"Because you watched X" rows, seeded from the titles finished most recently.</summary>
        public bool BecauseYouWatched { get; set; } = true;

        /// <summary>Netflix-style maturity-rating plate for the first seconds of playback.</summary>
        public bool RatingPlate { get; set; } = true;

        /// <summary>Ambient colour glow sampled from the hero / detail artwork (cinematic).</summary>
        public bool AmbientColor { get; set; } = true;

        /// <summary>Subtle film-grain texture over the UI (adds depth, kills banding). Off on TV.</summary>
        public bool FilmGrain { get; set; } = true;

        /// <summary>Show Netflix-style top navigation tabs (Home + libraries) in the header (replaces the Custom Tabs plugin).</summary>
        public bool NavTabs { get; set; } = true;

        /// <summary>
        /// Take over the home page for a clean Netflix layout: hide native / other-plugin
        /// rows + the page tab bar and show only our hero, a sharp Continue Watching row
        /// and the genre rows. Turn off to keep Jellyfin's native home sections.
        /// </summary>
        public bool CleanHome { get; set; } = true;

        /// <summary>
        /// Inject the header/hero script into index.html ourselves via built-in ASP.NET
        /// middleware — no File Transformation plugin needed. Defensive (only touches
        /// index.html, dedupes, fails open). Turn off to fall back to File Transformation
        /// / on-disk injection.
        /// </summary>
        public bool OwnInjection { get; set; } = true;

        /// <summary>
        /// Provide the File Transformation service to OTHER plugins (e.g. the Media Bar) so
        /// they work without installing the separate File Transformation plugin. Our
        /// middleware applies their registered index.html transformations. Turn off if you
        /// run the real File Transformation plugin to avoid two providers.
        /// </summary>
        public bool ProvideFileTransformation { get; set; } = true;

        /// <summary>Play a muted ~30s clip from the middle of the title when hovering a card (streamed on the fly, nothing stored).</summary>
        public bool PreviewClips { get; set; } = true;

        /// <summary>Netflix-style hover: the card grows and shows an info panel with action buttons.</summary>
        public bool HoverPreviewCard { get; set; } = true;

        /// <summary>Show big outlined rank numbers (1-10) on the first home row, like Netflix's Top 10.</summary>
        public bool TopTenRow { get; set; }

        /// <summary>Frosted-glass blur on the header, dialogs and panels.</summary>
        public bool GlassEffect { get; set; }

        /// <summary>Pure-black background for OLED screens.</summary>
        public bool OledBlack { get; set; }

        /// <summary>Left-align the header navigation (logo + tabs) like Netflix, instead of centering the tabs.</summary>
        public bool NavLeft { get; set; } = true;

        /// <summary>Show the community rating as a green "x% Match" like Netflix instead of a star value.</summary>
        public bool MatchScore { get; set; } = true;
    }
}
