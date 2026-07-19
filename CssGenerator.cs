using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;

namespace Jellyfin.Plugin.CustomTheme
{
    /// <summary>
    /// Builds the final stylesheet from <see cref="PluginConfiguration"/>.
    ///
    /// Strategy: the embedded <c>netflix.css</c> base theme is emitted unchanged,
    /// then a generated block is appended. User colours/fonts are applied by
    /// re-declaring the CSS custom properties in a trailing <c>:root</c> rule — it
    /// has the same specificity as the base declaration but appears later, so it
    /// wins by the cascade. This avoids brittle string replacement on the base CSS.
    /// Every toggle/option then emits a small, explicit rule.
    /// </summary>
    public static class CssGenerator
    {
        private const string BaseResource = "Jellyfin.Plugin.CustomTheme.netflix.css";

        private static readonly Dictionary<string, string> ProgressColors = new()
        {
            ["red"] = "#E50914",
            ["green"] = "#46D369",
            ["blue"] = "#0078D4",
            ["purple"] = "#9B59B6"
        };

        // accent, background, text, muted
        private static readonly Dictionary<string, (string Accent, string Bg, string Text, string Muted)> SeasonalPresets = new()
        {
            ["christmas"] = ("#C41E3A", "#1B2A1B", "#F0E6D3", "#8B9A7B"),
            ["halloween"] = ("#FF6600", "#1A1A0A", "#F5E6C8", "#8B8B6B"),
            ["summer"] = ("#FF9500", "#1A1520", "#FFF5E6", "#C4A882"),
            ["ocean"] = ("#0099CC", "#0A1628", "#E0F0FF", "#7BA3C4"),
            ["monochrome"] = ("#E5E5E5", "#0A0A0A", "#FFFFFF", "#808080"),
            ["colorful"] = ("#8A2BE2", "#12101A", "#FFFFFF", "#A99BC4")
        };

        // Google Fonts css2 query per font key. Only the SELECTED family is imported
        // (plus Bebas Neue for the Top-10 rank numbers when that feature is on) —
        // importing all 15 families on every page load cost several hundred KB.
        private static readonly Dictionary<string, string> FontImports = new()
        {
            ["inter"] = "Inter:wght@400;500;600;700;900",
            ["poppins"] = "Poppins:wght@400;500;600;700;900",
            ["montserrat"] = "Montserrat:wght@400;500;600;700;900",
            ["roboto"] = "Roboto:wght@400;500;700;900",
            ["oswald"] = "Oswald:wght@400;500;600;700",
            ["raleway"] = "Raleway:wght@400;500;600;700;900",
            ["nunito"] = "Nunito:wght@400;600;700;900",
            ["bebas"] = "Bebas+Neue",
            ["lato"] = "Lato:wght@400;700;900",
            ["sourcesans"] = "Source+Sans+3:wght@400;600;700;900",
            ["ubuntu"] = "Ubuntu:wght@400;500;700",
            ["playfair"] = "Playfair+Display:wght@400;700;900",
            ["quicksand"] = "Quicksand:wght@400;500;700",
            ["comfortaa"] = "Comfortaa:wght@400;600;700",
            ["righteous"] = "Righteous"
        };

        private static readonly Dictionary<string, string> Fonts = new()
        {
            ["inter"] = "'Inter', 'Helvetica Neue', Arial, sans-serif",
            ["poppins"] = "'Poppins', sans-serif",
            ["montserrat"] = "'Montserrat', sans-serif",
            ["roboto"] = "'Roboto', sans-serif",
            ["oswald"] = "'Oswald', sans-serif",
            ["raleway"] = "'Raleway', sans-serif",
            ["nunito"] = "'Nunito', sans-serif",
            ["bebas"] = "'Bebas Neue', sans-serif",
            ["lato"] = "'Lato', sans-serif",
            ["sourcesans"] = "'Source Sans 3', sans-serif",
            ["ubuntu"] = "'Ubuntu', sans-serif",
            ["playfair"] = "'Playfair Display', serif",
            ["quicksand"] = "'Quicksand', sans-serif",
            ["comfortaa"] = "'Comfortaa', sans-serif",
            ["righteous"] = "'Righteous', sans-serif"
        };

        public static string Generate(PluginConfiguration config)
        {
            var baseCss = LoadBaseCss();
            if (string.IsNullOrEmpty(baseCss))
            {
                return string.Empty;
            }

            // Resolve colours — a seasonal preset overrides the manual colours.
            // Values are validated: this CSS is served to EVERY client, so a broken
            // (or malicious) config value must not be able to break out of the rule.
            var accent = SafeColor(config.AccentColor, "#E50914");
            var bg = SafeColor(config.BgColor, "#141414");
            var text = SafeColor(config.TextColor, "#FFFFFF");
            var muted = SafeColor(config.MutedColor, "#B3B3B3");
            if (SeasonalPresets.TryGetValue(config.SeasonalTheme, out var preset))
            {
                accent = preset.Accent;
                bg = preset.Bg;
                text = preset.Text;
                muted = preset.Muted;
            }

            // OLED pure black overrides the background.
            if (config.OledBlack)
            {
                bg = "#000000";
            }

            var font = Fonts.GetValueOrDefault(config.FontFamily, Fonts["inter"]);
            var progress = string.Equals(config.ProgressColor, "accent", System.StringComparison.OrdinalIgnoreCase)
                ? accent
                : ProgressColors.GetValueOrDefault(config.ProgressColor, accent);

            var sb = new StringBuilder(baseCss.Length + 4096);

            // @import must precede all other rules. Load only the selected family
            // (+ Bebas Neue for the Top-10 rank numbers).
            var families = new List<string> { FontImports.GetValueOrDefault(config.FontFamily, FontImports["inter"]) };
            if (config.TopTenRow && config.FontFamily != "bebas")
            {
                families.Add(FontImports["bebas"]);
            }

            sb.Append("@import url('https://fonts.googleapis.com/css2?family=")
              .Append(string.Join("&family=", families))
              .AppendLine("&display=swap');");
            sb.AppendLine();
            sb.Append(baseCss);
            sb.AppendLine();
            sb.AppendLine();
            sb.AppendLine("/* ============================================");
            sb.AppendLine("   GENERATED FROM PLUGIN SETTINGS");
            sb.AppendLine("   ============================================ */");

            // --- Variable overrides (win by cascade order) ---
            sb.AppendLine(":root {");
            sb.AppendLine($"    --accent-red: {accent};");
            sb.AppendLine($"    --accent-red-hover: {Lighten(accent, 0.15)};");
            sb.AppendLine($"    --bg-dark: {bg};");
            sb.AppendLine($"    --text-main: {text};");
            sb.AppendLine($"    --text-muted: {muted};");
            sb.AppendLine($"    --card-radius: {config.CardRadius}px;");
            sb.AppendLine($"    --font-netflix: {font};");
            sb.AppendLine($"    --progress-color: {progress};");
            sb.AppendLine("}");

            // --- Always-on extras (moved out of the base theme) ---
            sb.AppendLine(".itemProgressBar-inner, .progressBarFill { background-color: var(--progress-color) !important; }");
            sb.AppendLine(".headerUserButton .headerButton-icon { display: none !important; }");
            sb.AppendLine(".headerUserButton { overflow: hidden !important; border-radius: 4px !important; }");

            AppendLogo(sb, config);
            AppendElements(sb, config);
            AppendButtons(sb, config);
            AppendLayout(sb, config);
            AppendNetflixExtras(sb, config);
            AppendPanelStyles(sb);

            return sb.ToString();
        }

        private static void AppendLogo(StringBuilder sb, PluginConfiguration config)
        {
            switch (config.LogoStyle)
            {
                case "jellyfin":
                    sb.AppendLine(@".headerLeft::before {
    content: '' !important;
    background-image: url('data:image/svg+xml,%3Csvg xmlns=""http://www.w3.org/2000/svg"" viewBox=""0 0 512 512""%3E%3Cdefs%3E%3ClinearGradient id=""g"" x1=""0%25"" y1=""0%25"" x2=""100%25"" y2=""100%25""%3E%3Cstop offset=""0%25"" stop-color=""%23aa5cc3""/%3E%3Cstop offset=""100%25"" stop-color=""%2300a4dc""/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d=""M256 70c-54 0-103 28-140 72-37 44-56 102-56 152 0 36 22 72 56 100 37 30 86 48 140 48s103-18 140-48c34-28 56-64 56-100 0-50-19-108-56-152-37-44-86-72-140-72zm0 62c34 0 66 18 90 48 24 28 38 66 38 98 0 18-12 38-32 54-22 18-52 30-96 30s-74-12-96-30c-20-16-32-36-32-54 0-32 14-70 38-98 24-30 56-48 90-48zm0 84c-16 0-28 8-36 20-8 10-12 24-12 36 0 14 10 28 26 28s28-8 36-20c8-10 12-24 12-36 0-14-10-28-26-28z"" fill=""url(%23g)""/%3E%3C/svg%3E') !important;
    background-size: contain !important; background-repeat: no-repeat !important;
    width: 36px !important; height: 36px !important; display: inline-block !important;
    text-shadow: none !important; font-size: 0 !important;
}");
                    break;
                case "letter":
                    var letter = SanitizeLetter(config.LogoLetter);
                    sb.AppendLine($@".headerLeft::before {{
    content: '{letter}' !important; color: var(--accent-red) !important;
    font-weight: 900 !important; font-size: 2.6rem !important; letter-spacing: -2px !important;
    text-shadow: 0 0 15px rgba(229,9,20,0.4) !important; display: flex !important;
    align-items: center !important; transform: scaleY(1.1) !important;
    font-family: var(--font-netflix) !important; width: auto !important; height: auto !important;
    background: none !important;
}}");
                    break;
                case "custom" when !string.IsNullOrWhiteSpace(config.CustomLogoUrl):
                    var url = SanitizeUrl(config.CustomLogoUrl);
                    if (!string.IsNullOrEmpty(url))
                    {
                        sb.AppendLine($@".headerLeft::before {{
    content: '' !important; background-image: url('{url}') !important;
    background-size: contain !important; background-repeat: no-repeat !important;
    width: 40px !important; height: 30px !important; display: inline-block !important;
    text-shadow: none !important; font-size: 0 !important;
}}");
                    }

                    break;
                case "none":
                    sb.AppendLine(".headerLeft::before { display: none !important; }");
                    break;

                // "netflix" — the base theme already renders the red 'N'.
            }
        }

        private static void AppendElements(StringBuilder sb, PluginConfiguration config)
        {
            if (!config.ShowBadges)
            {
                sb.AppendLine(".indicator:not(.indicatorIcon) { display: none !important; }");
            }

            if (!config.ShowPlayed)
            {
                sb.AppendLine(".indicatorIcon { display: none !important; }");
            }

            if (!config.ShowBackdrop)
            {
                sb.AppendLine(".backdropContainer { opacity: 0 !important; }");
                sb.AppendLine(".backgroundContainer.withBackdrop { background-image: none !important; background-color: var(--bg-dark) !important; }");
            }

            if (!config.RoundCast)
            {
                sb.AppendLine(".personCard .cardScalable, .personCard .cardImageContainer { border-radius: 8px !important; }");
            }

            if (!config.ShowDescription)
            {
                sb.AppendLine(".overview-text, .itemOverview { display: none !important; }");
            }

            if (!config.ShowTags)
            {
                sb.AppendLine(".itemTags { display: none !important; }");
            }

            if (!config.ShowExternalLinks)
            {
                sb.AppendLine(".itemExternalLinks { display: none !important; }");
            }

            if (!config.ShowSimilar)
            {
                sb.AppendLine("#similarCollapsible { display: none !important; }");
            }

            if (config.HeaderBlur)
            {
                sb.AppendLine(".skinHeader { backdrop-filter: blur(12px) !important; -webkit-backdrop-filter: blur(12px) !important; }");
            }

            if (config.SpoilerMode)
            {
                sb.AppendLine(@".overview-text, .itemOverview { filter: blur(8px) !important; cursor: pointer !important; transition: filter 0.3s ease !important; }
.overview-text:hover, .itemOverview:hover { filter: none !important; }
.card:not(:has(.indicatorIcon)) .cardImageContainer { filter: blur(10px) brightness(0.6) !important; transition: filter 0.3s ease !important; }
.card:not(:has(.indicatorIcon)) .cardImageContainer:hover { filter: none !important; }");
            }
        }

        private static void AppendButtons(StringBuilder sb, PluginConfiguration config)
        {
            // Scoped to the detail page — the video OSD reuses these class names.
            if (!config.ShowBtnWatched)
            {
                sb.AppendLine(".mainDetailButtons .btnPlaystate { display: none !important; }");
            }

            if (!config.ShowBtnFavorite)
            {
                sb.AppendLine(".mainDetailButtons .btnUserRating { display: none !important; }");
            }

            if (!config.ShowBtnMore)
            {
                sb.AppendLine(".mainDetailButtons .btnMoreCommands { display: none !important; }");
            }
        }

        private static void AppendLayout(StringBuilder sb, PluginConfiguration config)
        {
            // Font size
            if (config.FontSize == "small")
            {
                sb.AppendLine("body { font-size: 14px !important; }");
            }
            else if (config.FontSize == "large")
            {
                sb.AppendLine("body { font-size: 18px !important; }");
            }

            // Title size. The unscoped rule would also override the base sheet's
            // phone downscale (it appears later in the cascade), so re-assert a
            // mobile cap alongside the larger sizes.
            if (config.TitleSize == "small")
            {
                sb.AppendLine(".itemName { font-size: 1.8rem !important; }");
            }
            else if (config.TitleSize == "huge")
            {
                sb.AppendLine(".itemName { font-size: 4.5rem !important; }");
                sb.AppendLine("@media (max-width: 768px) { .itemName { font-size: 2.2rem !important; } }");
            }

            // Card size. Native rows use min-width; our genre/CW rows size via width
            // clamps, so they get their own scaled rules (a plain min-width here used
            // to make "small" cards BIGGER on the theme's own rows).
            if (config.CardSize == "small")
            {
                sb.AppendLine(".homeSectionsContainer .card.overflowPortraitCard:not(.personCard) { min-width: 120px !important; }");
                sb.AppendLine(".homeSectionsContainer .card.overflowBackdropCard:not(.nf-card) { min-width: 240px !important; }");
                sb.AppendLine(".nf-genre-section .card.nf-card { width: clamp(140px, 12.5vw, 240px) !important; }");
                sb.AppendLine(".nf-cw-card { width: clamp(180px, 15.5vw, 280px) !important; }");
            }
            else if (config.CardSize == "large")
            {
                sb.AppendLine(".homeSectionsContainer .card.overflowPortraitCard:not(.personCard) { min-width: 200px !important; }");
                sb.AppendLine(".homeSectionsContainer .card.overflowBackdropCard:not(.nf-card) { min-width: 420px !important; }");
                sb.AppendLine(".nf-genre-section .card.nf-card { width: clamp(200px, 18.5vw, 330px) !important; }");
                sb.AppendLine(".nf-cw-card { width: clamp(260px, 22.5vw, 400px) !important; }");
            }

            // Card style
            if (config.CardStyle == "portrait")
            {
                sb.AppendLine(".card.overflowBackdropCard .cardPadder { padding-bottom: 150% !important; }");
                sb.AppendLine(".card.overflowBackdropCard .cardImageContainer { background-position: center !important; }");
            }
            else if (config.CardStyle == "landscape")
            {
                sb.AppendLine(".card.overflowPortraitCard:not(.personCard) .cardPadder { padding-bottom: 56.25% !important; }");
                sb.AppendLine(".card.overflowPortraitCard:not(.personCard) .cardImageContainer { background-position: center top !important; }");
            }

            // Card hover zoom
            if (!config.CardHoverScale)
            {
                sb.AppendLine(".card:hover { transform: none !important; box-shadow: none !important; }");
            }

            // Card info overlay
            if (config.CardInfoOverlay)
            {
                sb.AppendLine(@".cardOverlayContainer { display: flex !important; flex-direction: column !important; justify-content: flex-end !important; padding: 10px 12px !important; }
.card:hover .cardOverlayContainer { opacity: 1 !important; }
.cardOverlayContainer .cardOverlayButtonContainer { margin-top: auto !important; }");
            }

            // Gradient strength
            if (config.GradientStrength == "light")
            {
                sb.AppendLine(".backgroundContainer.withBackdrop { background-image: linear-gradient(to top, var(--bg-dark) 0%, rgba(20,20,20,0.4) 15%, transparent 40%), linear-gradient(to right, rgba(20,20,20,0.5) 0%, transparent 25%) !important; }");
            }
            else if (config.GradientStrength == "heavy")
            {
                sb.AppendLine(".backgroundContainer.withBackdrop { background-image: linear-gradient(to top, var(--bg-dark) 0%, rgba(20,20,20,0.85) 30%, rgba(20,20,20,0.5) 60%), linear-gradient(to right, rgba(20,20,20,0.95) 0%, transparent 45%), linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 20%) !important; }");
            }

            // Animation speed
            if (config.AnimSpeed == "fast")
            {
                sb.AppendLine(".card, .skinHeader, .cardOverlayContainer, .btnPlaystate, .btnUserRating, .btnMoreCommands { transition-duration: 0.12s !important; }");
            }
            else if (config.AnimSpeed == "slow")
            {
                sb.AppendLine(".card, .skinHeader, .cardOverlayContainer, .btnPlaystate, .btnUserRating, .btnMoreCommands { transition-duration: 0.6s !important; }");
            }
            else if (config.AnimSpeed == "off")
            {
                sb.AppendLine(".card, .skinHeader, .cardOverlayContainer, .cardScalable, .btnPlaystate, .btnUserRating, .btnMoreCommands { transition-duration: 0s !important; }");
                sb.AppendLine(".card:hover { transform: none !important; }");
                sb.AppendLine(".view-transition { animation: none !important; }");
            }

            // Compact sidebar
            if (config.SidebarCompact)
            {
                sb.AppendLine(@".mainDrawer { width: 60px !important; }
.navMenuOption .navMenuOptionText { display: none !important; }
.navMenuOption { justify-content: center !important; padding: 12px 0 !important; }
.navMenuOption .material-icons { margin: 0 !important; }
.sidebarHeader { display: none !important; }");
            }

            // Ambient glow
            if (config.AmbientGlow)
            {
                sb.AppendLine("body::after { content: ''; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(ellipse at 50% 0%, rgba(229,9,20,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 50%, rgba(229,9,20,0.03) 0%, transparent 50%); pointer-events: none; z-index: 0; }");
            }
        }

        /// <summary>Netflix-style extras: hover preview cards, Top 10 numbers, glass, OLED, detail polish.</summary>
        private static void AppendNetflixExtras(StringBuilder sb, PluginConfiguration config)
        {
            if (config.HoverPreviewCard)
            {
                // Overlay styling — independent of the zoom motion.
                sb.AppendLine(@".cardOverlayContainer { background: linear-gradient(to top, rgba(20,20,20,0.97) 0%, rgba(20,20,20,0.75) 40%, transparent 75%) !important; }
.card:hover .cardOverlayContainer { opacity: 1 !important; }
.cardOverlayButtonContainer { display: flex !important; align-items: center !important; gap: 6px !important; }
.cardOverlayContainer .paper-icon-button-light { background: rgba(255,255,255,0.12) !important; border: 1px solid rgba(255,255,255,0.5) !important; border-radius: 50% !important; width: 30px !important; height: 30px !important; transition: transform 0.15s ease, background 0.15s ease !important; }
.cardOverlayContainer .paper-icon-button-light:hover { transform: scale(1.15) !important; background: rgba(255,255,255,0.25) !important; }
.cardOverlayContainer .cardOverlayButton-br .paper-icon-button-light { background: rgba(255,255,255,0.92) !important; color: #000 !important; }");

                // Zoom motion — respects the CardHoverScale toggle (this block used to
                // silently re-enable zoom that AppendLayout had just disabled). The
                // neighbour-slide targets horizontal ROWS only: .scrollSlider (native)
                // and .nf-row-track (our genre rows); .itemsContainer used to shear
                // whole grid pages sideways.
                if (config.CardHoverScale)
                {
                    sb.AppendLine(@".card:hover { transform: none !important; box-shadow: none !important; z-index: 60 !important; }
.card:hover .cardScalable { transform: scale(1.2) !important; transform-origin: center center !important; box-shadow: 0 18px 40px rgba(0,0,0,0.85) !important; border-radius: 6px !important; }
.scrollSlider:not(.similarContent) > .card:hover ~ .card, .nf-row-track > .card:hover ~ .card { transform: translateX(30px) !important; }
.scrollSlider:not(.similarContent) > .card:has(~ .card:hover), .nf-row-track > .card:has(~ .card:hover) { transform: translateX(-30px) !important; }
.scrollSlider > .card:first-child:hover .cardScalable, .nf-row-track > .card:first-child:hover .cardScalable { transform-origin: left center !important; }
.scrollSlider > .card:last-child:hover .cardScalable, .nf-row-track > .card:last-child:hover .cardScalable { transform-origin: right center !important; }
@media (prefers-reduced-motion: reduce) {
.card:hover .cardScalable { transform: none !important; }
.scrollSlider > .card:hover ~ .card, .nf-row-track > .card:hover ~ .card { transform: none !important; }
.scrollSlider > .card:has(~ .card:hover), .nf-row-track > .card:has(~ .card:hover) { transform: none !important; }
}");
                }
                else
                {
                    sb.AppendLine(".card:hover { z-index: 60 !important; }");
                }
            }

            if (config.NavLeft)
            {
                // Logo + tabs pinned to the left like Netflix, instead of centered tabs.
                sb.AppendLine(@".headerTabs.sectionTabs { position: static !important; left: auto !important; transform: none !important; margin: 0 0 0 10px !important; }
.headerLeft { flex: 0 0 auto !important; }
.skinHeader .headerLeft { margin-right: 8px !important; }");
            }

            if (config.MatchScore)
            {
                // Community rating is restyled green; headerButton.js rewrites the value to "x% Match".
                // Detail pages put the value directly in .starRatingContainer (no .starRatingValue).
                sb.AppendLine(@".starRatingValue, .starRatingContainer { color: #46d369 !important; font-weight: 700 !important; }
.starIcon { display: none !important; }");
            }

            if (config.TopTenRow)
            {
                // Styling for rank numbers injected by headerButton.js. The card is
                // made the positioning context explicitly — nothing else guarantees it.
                sb.AppendLine(@".ct-rank { position: absolute; inset-inline-start: -6px; bottom: -6px; z-index: 1; font-family: 'Bebas Neue', var(--font-netflix); font-size: 5.5rem; font-weight: 900; line-height: 0.8; color: #1a1a1a; -webkit-text-stroke: 3px var(--text-muted); pointer-events: none; }
.ct-rank-card { display: flex !important; align-items: flex-end !important; position: relative !important; }
.ct-rank-card .cardScalable { margin-inline-start: 42% !important; }");
            }

            if (config.GlassEffect)
            {
                sb.AppendLine(@".skinHeader { backdrop-filter: blur(16px) saturate(140%) !important; -webkit-backdrop-filter: blur(16px) saturate(140%) !important; background: rgba(10,10,10,0.55) !important; }
.dialog, .formDialog, .actionSheet, .ct-overlay { backdrop-filter: blur(20px) saturate(160%) !important; -webkit-backdrop-filter: blur(20px) saturate(160%) !important; background: rgba(26,26,26,0.78) !important; }
.mainDrawer { backdrop-filter: blur(18px) !important; -webkit-backdrop-filter: blur(18px) !important; background: rgba(10,10,10,0.6) !important; }");
            }

            if (config.OledBlack)
            {
                sb.AppendLine(@":root { --bg-darker: #000000; }
.cardBox, .card .cardImageContainer { background-color: #0a0a0a !important; }");
            }

            // Detail page polish (always on — lightweight). Covers series: seasons + episode list.
            sb.AppendLine(@".detailPagePrimaryContent .sectionTitle { font-size: 1.3rem !important; font-weight: 700 !important; }
.castContent .card, .peopleCards .card { --card-radius: 50%; }
/* Episode list rows */
.listItem { border-radius: 8px !important; padding: 10px 12px !important; transition: background 0.2s ease !important; }
.listItem:hover { background: rgba(255,255,255,0.07) !important; }
.listItemImage { border-radius: 6px !important; }
.listItemBody .listItemBodyText { font-family: var(--font-netflix) !important; }
.listItem .secondary, .listItemBodyText.secondary { color: var(--text-muted) !important; }
/* Season selector / tabs on a series */
.detailPageContent .emby-select, .seasonSelector { background: rgba(255,255,255,0.08) !important; border: 1px solid rgba(255,255,255,0.18) !important; border-radius: 6px !important; color: var(--text-main) !important; }
.childrenItemsContainer .card { --card-radius: 6px; }
/* Episode play progress + unplayed look consistent with cards */
.listItem .itemProgressBar { border-radius: 4px !important; overflow: hidden !important; }");
        }

        /// <summary>Styles for the slide-in settings panel created by headerButton.js.</summary>
        private static void AppendPanelStyles(StringBuilder sb)
        {
            sb.AppendLine(@"
/* Header settings button + slide-in panel */
.ct-settings-btn { background: none !important; border: none !important; color: inherit !important; cursor: pointer; display: inline-flex !important; align-items: center !important; justify-content: center !important; padding: 0 8px !important; opacity: 0.85; transition: opacity 0.2s ease; }
.ct-settings-btn:hover { opacity: 1; }
.ct-overlay-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 999998; opacity: 0; transition: opacity 0.3s ease; }
.ct-overlay-bg.open { opacity: 1; }
.ct-overlay { position: fixed; top: 0; right: -440px; width: 400px; max-width: 90vw; height: 100vh; background: #1a1a1a; color: #fff; z-index: 999999; overflow-y: auto; transition: right 0.3s cubic-bezier(0.4,0,0.2,1); box-shadow: -5px 0 30px rgba(0,0,0,0.5); font-family: var(--font-netflix); }
.ct-overlay.open { right: 0; }
.ct-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #2a2a2a; position: sticky; top: 0; background: #1a1a1a; z-index: 1; }
.ct-header h2 { margin: 0; font-size: 1.2rem; }
.ct-close { background: none; border: none; color: #aaa; font-size: 28px; line-height: 1; cursor: pointer; padding: 0 4px; min-width: 40px; min-height: 40px; }
.ct-close:hover { color: #fff; }
.ct-body { padding: 12px 20px 48px; }
.ct-sec { margin-bottom: 18px; }
.ct-sec-title { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #2a2a2a; }
.ct-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 7px 0; font-size: 0.9rem; color: #ddd; }
.ct-row select { background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; padding: 5px 8px; font-size: 0.8rem; max-width: 55%; }
.ct-row input[type=text] { background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; padding: 5px 8px; font-size: 0.8rem; max-width: 55%; }
.ct-row input[type=color] { width: 38px; height: 28px; border: 2px solid #555; border-radius: 4px; cursor: pointer; padding: 0; background: none; flex-shrink: 0; }
.ct-switch { position: relative; width: 42px; height: 22px; flex-shrink: 0; }
.ct-switch input { opacity: 0; width: 0; height: 0; }
.ct-slider { position: absolute; inset: 0; background: #555; border-radius: 22px; cursor: pointer; transition: background 0.2s; }
.ct-slider::before { content: ''; position: absolute; width: 16px; height: 16px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: transform 0.2s; }
.ct-switch input:checked + .ct-slider { background: var(--accent-red); }
.ct-switch input:checked + .ct-slider::before { transform: translateX(20px); }
.ct-save-btn { width: 100%; padding: 12px; background: var(--accent-red); color: #fff; border: none; border-radius: 4px; font-size: 1rem; font-weight: 700; cursor: pointer; margin-top: 16px; font-family: var(--font-netflix); }
.ct-save-btn:hover { background: var(--accent-red-hover); }
.ct-save-status { text-align: center; margin-top: 10px; font-size: 0.85rem; min-height: 20px; }");
        }

        private static string LoadBaseCss()
        {
            var assembly = Assembly.GetExecutingAssembly();
            using var stream = assembly.GetManifestResourceStream(BaseResource);
            if (stream == null)
            {
                return string.Empty;
            }

            using var reader = new StreamReader(stream);
            return reader.ReadToEnd();
        }

        /// <summary>Mixes a hex colour toward white by <paramref name="amount"/> (0..1). Returns the input unchanged if it is not a #RRGGBB string.</summary>
        private static string Lighten(string hex, double amount)
        {
            if (string.IsNullOrEmpty(hex) || hex.Length != 7 || hex[0] != '#')
            {
                return hex;
            }

            if (!int.TryParse(hex.AsSpan(1, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var r) ||
                !int.TryParse(hex.AsSpan(3, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var g) ||
                !int.TryParse(hex.AsSpan(5, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var b))
            {
                return hex;
            }

            r = (int)(r + ((255 - r) * amount));
            g = (int)(g + ((255 - g) * amount));
            b = (int)(b + ((255 - b) * amount));
            return string.Create(CultureInfo.InvariantCulture, $"#{r:X2}{g:X2}{b:X2}");
        }

        private static string SanitizeLetter(string letter)
        {
            if (string.IsNullOrEmpty(letter))
            {
                return "N";
            }

            var c = letter[0];
            return char.IsLetterOrDigit(c) ? c.ToString() : "N";
        }

        /// <summary>Returns the value when it is a safe CSS colour (hex, named, or a plain
        /// rgb()/rgba()/hsl()/hsla() function — the forms that worked before validation
        /// existed), otherwise the fallback.</summary>
        private static string SafeColor(string value, string fallback)
        {
            return !string.IsNullOrEmpty(value)
                && Regex.IsMatch(value, @"^(#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|[a-zA-Z]{3,25}|(?:rgb|rgba|hsl|hsla)\([\d\s,.%/]{1,40}\))$")
                ? value
                : fallback;
        }

        private static string SanitizeUrl(string url)
        {
            // Admin-only input, but keep it from breaking out of the url('...') context
            // and restrict it to schemes that make sense for a logo image.
            var cleaned = url.Replace("'", string.Empty)
                             .Replace("\"", string.Empty)
                             .Replace("(", string.Empty)
                             .Replace(")", string.Empty)
                             .Replace("\\", string.Empty)
                             .Replace("\n", string.Empty)
                             .Replace("\r", string.Empty)
                             .Trim();
            return cleaned.StartsWith("http://", System.StringComparison.OrdinalIgnoreCase)
                || cleaned.StartsWith("https://", System.StringComparison.OrdinalIgnoreCase)
                || cleaned.StartsWith("data:image/", System.StringComparison.OrdinalIgnoreCase)
                || cleaned.StartsWith("/", System.StringComparison.Ordinal)
                || !cleaned.Contains(':') // scheme-less relative path (resolves against /web/)
                ? cleaned
                : string.Empty;
        }
    }
}
