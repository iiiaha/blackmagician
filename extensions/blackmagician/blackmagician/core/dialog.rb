Sketchup.require(File.join(__dir__, 'material'))

module BlackMagician
  LIBRARY_URL = 'https://blackmagician.pages.dev'

  def self.show_dialog
    if @dialog && @dialog.visible?
      @dialog.bring_to_front
      return
    end

    @dialog = UI::HtmlDialog.new(
      dialog_title:    'Black Magician',
      preferences_key: 'BlackMagician',
      width:           900,
      height:          650,
      resizable:       true,
      style:           UI::HtmlDialog::STYLE_DIALOG
    )

    register_callbacks(@dialog)

    # Show loading screen first, then redirect to library
    loading_html = <<~HTML
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fafafa;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          flex-direction: column;
          gap: 16px;
        }
        .spinner {
          width: 24px; height: 24px;
          border: 2.5px solid #e0e0e0;
          border-top-color: #1a1a1a;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .text { font-size: 11px; color: #999; letter-spacing: 0.5px; }
      </style>
      </head>
      <body>
        <div class="spinner"></div>
        <div class="text">Loading...</div>
        <script>
          setTimeout(function() {
            window.location.href = '#{LIBRARY_URL}';
          }, 100);
        </script>
      </body>
      </html>
    HTML

    @dialog.set_html(loading_html)
    @dialog.center
    @dialog.show
  end

  def self.register_callbacks(dialog)
    # Insert: Canvas image → SketchUp material
    dialog.add_action_callback('insert_material') do |_ctx, data_url, vendor, tile_name, size_str|
      begin
        final_name = MaterialManager.insert(data_url, vendor, tile_name, size_str)
        dialog.execute_script("onInsertResult(true, #{final_name.to_json})")
      rescue => e
        dialog.execute_script("onInsertResult(false, #{e.message.to_json})")
      end
    end
  end

  unless file_loaded?(File.basename(__FILE__))
    # Menu — shared "iiiaha Materials" submenu under Extensions, populated
    # by every iiiaha vendor / library extension that loads (blackmagician,
    # younhyun, future vendors). The defined? guards make this safe whether
    # we're the first to load or a later one.
    module ::Iiiaha; end unless defined?(::Iiiaha)
    unless defined?(Iiiaha::MATERIALS_MENU)
      Iiiaha.const_set(:MATERIALS_MENU, UI.menu('Extensions').add_submenu('iiiaha Materials'))
    end
    Iiiaha::MATERIALS_MENU.add_item('Black Magician') { show_dialog }

    # Toolbar
    icon_dir = File.join(PLUGIN_DIR, 'blackmagician', 'icons')
    toolbar = UI::Toolbar.new('iiiaha_blackmagician')
    cmd = UI::Command.new('Black Magician') { show_dialog }
    cmd.small_icon = File.join(icon_dir, 'logopic_24.png')
    cmd.large_icon = File.join(icon_dir, 'logopic_32.png')
    cmd.tooltip = 'Black Magician'
    cmd.status_bar_text = 'Open Black Magician'
    toolbar.add_item(cmd)
    toolbar.show

    file_loaded(File.basename(__FILE__))
  end
end
