// Accessibility Plugin for CryptoDash
// Manages accessibility features like text size, contrast, spacing, etc.

(function() {
  'use strict';

  // Load saved settings from localStorage
  function loadSettings() {
    const settings = localStorage.getItem('accessibility-settings');
    return settings ? JSON.parse(settings) : {
      textSize: 'normal',
      contrast: 'normal',
      lineHeight: 'normal',
      letterSpacing: 'normal',
      dyslexiaFont: false,
      bigCursor: false,
      readingGuide: false
    };
  }

  // Save settings to localStorage
  function saveSettings(settings) {
    localStorage.setItem('accessibility-settings', JSON.stringify(settings));
  }

  // Current settings
  let settings = loadSettings();

  // Toggle accessibility panel
  const accessibilityBtn = document.getElementById('accessibilityBtn');
  const accessibilityPanel = document.getElementById('accessibilityPanel');
  const closeAccessibility = document.getElementById('closeAccessibility');

  accessibilityBtn.addEventListener('click', function() {
    const isVisible = accessibilityPanel.style.display === 'block';
    accessibilityPanel.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
      // Animate in
      accessibilityPanel.style.opacity = '0';
      accessibilityPanel.style.transform = 'translateY(20px)';
      setTimeout(() => {
        accessibilityPanel.style.transition = 'all 0.3s ease';
        accessibilityPanel.style.opacity = '1';
        accessibilityPanel.style.transform = 'translateY(0)';
      }, 10);
    }
  });

  closeAccessibility.addEventListener('click', function() {
    accessibilityPanel.style.display = 'none';
  });

  // Close panel when clicking outside
  document.addEventListener('click', function(e) {
    if (!accessibilityBtn.contains(e.target) && !accessibilityPanel.contains(e.target)) {
      accessibilityPanel.style.display = 'none';
    }
  });

  // Text Size
  document.querySelectorAll('[data-text-size]').forEach(btn => {
    btn.addEventListener('click', function() {
      const size = this.getAttribute('data-text-size');
      settings.textSize = size;
      applyTextSize(size);
      saveSettings(settings);
      updateActiveButton(this);
    });
  });

  function applyTextSize(size) {
    document.body.classList.remove('text-small', 'text-large', 'text-xlarge');
    if (size !== 'normal') {
      document.body.classList.add('text-' + size);
    }
  }

  // Contrast
  document.querySelectorAll('[data-contrast]').forEach(btn => {
    btn.addEventListener('click', function() {
      const contrast = this.getAttribute('data-contrast');
      settings.contrast = contrast;
      applyContrast(contrast);
      saveSettings(settings);
      updateActiveButton(this);
    });
  });

  function applyContrast(contrast) {
    document.body.classList.remove('contrast-high', 'contrast-dark');
    if (contrast !== 'normal') {
      document.body.classList.add('contrast-' + contrast);
    }
  }

  // Line Height
  document.querySelectorAll('[data-line-height]').forEach(btn => {
    btn.addEventListener('click', function() {
      const lineHeight = this.getAttribute('data-line-height');
      settings.lineHeight = lineHeight;
      applyLineHeight(lineHeight);
      saveSettings(settings);
      updateActiveButton(this);
    });
  });

  function applyLineHeight(lineHeight) {
    document.body.classList.remove('line-height-medium', 'line-height-large');
    if (lineHeight !== 'normal') {
      document.body.classList.add('line-height-' + lineHeight);
    }
  }

  // Letter Spacing
  document.querySelectorAll('[data-letter-spacing]').forEach(btn => {
    btn.addEventListener('click', function() {
      const spacing = this.getAttribute('data-letter-spacing');
      settings.letterSpacing = spacing;
      applyLetterSpacing(spacing);
      saveSettings(settings);
      updateActiveButton(this);
    });
  });

  function applyLetterSpacing(spacing) {
    document.body.classList.remove('letter-spacing-wide');
    if (spacing !== 'normal') {
      document.body.classList.add('letter-spacing-' + spacing);
    }
  }

  // Dyslexia Font
  document.getElementById('dyslexiaFont').addEventListener('change', function() {
    settings.dyslexiaFont = this.checked;
    applyDyslexiaFont(this.checked);
    saveSettings(settings);
  });

  function applyDyslexiaFont(enabled) {
    if (enabled) {
      document.body.style.fontFamily = 'Arial, sans-serif';
    } else {
      document.body.style.fontFamily = '';
    }
  }

  // Big Cursor
  document.getElementById('bigCursor').addEventListener('change', function() {
    settings.bigCursor = this.checked;
    applyBigCursor(this.checked);
    saveSettings(settings);
  });

  function applyBigCursor(enabled) {
    if (enabled) {
      document.body.classList.add('big-cursor');
    } else {
      document.body.classList.remove('big-cursor');
    }
  }

  // Reading Guide
  const readingGuideLine = document.getElementById('readingGuideLine');
  document.getElementById('readingGuide').addEventListener('change', function() {
    settings.readingGuide = this.checked;
    applyReadingGuide(this.checked);
    saveSettings(settings);
  });

  function applyReadingGuide(enabled) {
    if (enabled) {
      readingGuideLine.style.display = 'block';
      document.addEventListener('mousemove', updateReadingGuide);
    } else {
      readingGuideLine.style.display = 'none';
      document.removeEventListener('mousemove', updateReadingGuide);
    }
  }

  function updateReadingGuide(e) {
    readingGuideLine.style.top = e.clientY + 'px';
  }

  // Reset All
  document.getElementById('resetAccessibility').addEventListener('click', function() {
    settings = {
      textSize: 'normal',
      contrast: 'normal',
      lineHeight: 'normal',
      letterSpacing: 'normal',
      dyslexiaFont: false,
      bigCursor: false,
      readingGuide: false
    };

    applyAllSettings();
    saveSettings(settings);
    resetActiveButtons();

    // Reset checkboxes
    document.getElementById('dyslexiaFont').checked = false;
    document.getElementById('bigCursor').checked = false;
    document.getElementById('readingGuide').checked = false;

    // Show toast notification
    if (typeof showToast === 'function') {
      showToast('הגדרות נגישות אופסו', 'info');
    }
  });

  // Helper function to update active button in button group
  function updateActiveButton(clickedBtn) {
    const group = clickedBtn.closest('.btn-group');
    if (group) {
      group.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
      clickedBtn.classList.add('active');
    }
  }

  // Helper function to reset all active buttons
  function resetActiveButtons() {
    document.querySelectorAll('[data-text-size="normal"]').forEach(btn => {
      updateActiveButton(btn);
    });
    document.querySelectorAll('[data-contrast="normal"]').forEach(btn => {
      updateActiveButton(btn);
    });
    document.querySelectorAll('[data-line-height="normal"]').forEach(btn => {
      updateActiveButton(btn);
    });
    document.querySelectorAll('[data-letter-spacing="normal"]').forEach(btn => {
      updateActiveButton(btn);
    });
  }

  // Apply all settings
  function applyAllSettings() {
    applyTextSize(settings.textSize);
    applyContrast(settings.contrast);
    applyLineHeight(settings.lineHeight);
    applyLetterSpacing(settings.letterSpacing);
    applyDyslexiaFont(settings.dyslexiaFont);
    applyBigCursor(settings.bigCursor);
    applyReadingGuide(settings.readingGuide);
  }

  // Initialize - Apply saved settings on page load
  function init() {
    applyAllSettings();

    // Update UI to reflect saved settings
    document.querySelectorAll('[data-text-size]').forEach(btn => {
      if (btn.getAttribute('data-text-size') === settings.textSize) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    document.querySelectorAll('[data-contrast]').forEach(btn => {
      if (btn.getAttribute('data-contrast') === settings.contrast) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    document.querySelectorAll('[data-line-height]').forEach(btn => {
      if (btn.getAttribute('data-line-height') === settings.lineHeight) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    document.querySelectorAll('[data-letter-spacing]').forEach(btn => {
      if (btn.getAttribute('data-letter-spacing') === settings.letterSpacing) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    document.getElementById('dyslexiaFont').checked = settings.dyslexiaFont;
    document.getElementById('bigCursor').checked = settings.bigCursor;
    document.getElementById('readingGuide').checked = settings.readingGuide;
  }

  // Run initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
