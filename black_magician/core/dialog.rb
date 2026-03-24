require_relative 'material'

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

  def self.pbr_supported?
    Sketchup.version.to_i >= 25
  end

  def self.register_callbacks(dialog)
    # Report SketchUp version to JS (so web knows if PBR is supported)
    dialog.add_action_callback('get_su_version') do |_ctx|
      ver = Sketchup.version.to_i
      pbr = pbr_supported? ? 'true' : 'false'
      dialog.execute_script("window.__SU_VERSION=#{ver};window.__SU_PBR=#{pbr};")
    end

    # Insert: Canvas image → SketchUp material (with optional PBR maps)
    dialog.add_action_callback('insert_material') do |_ctx, json_str|
      begin
        data = JSON.parse(json_str)
        final_name = MaterialManager.insert(data, pbr_supported?)
        dialog.execute_script("onInsertResult(true, '#{final_name}')")
      rescue => e
        dialog.execute_script("onInsertResult(false, '#{e.message.gsub("'", "\\\\'")}')")
      end
    end
  end

  unless file_loaded?(File.basename(__FILE__))
    # Menu
    menu = UI.menu('Plugins')
    menu.add_item('Black Magician') { show_dialog }

    # Toolbar
    icon_dir = File.join(PLUGIN_DIR, 'black_magician', 'icons')
    toolbar = UI::Toolbar.new('Black Magician')
    cmd = UI::Command.new('Black Magician') { show_dialog }
    cmd.small_icon = File.join(icon_dir, 'logopic_24.png')
    cmd.large_icon = File.join(icon_dir, 'logopic_32.png')
    cmd.tooltip = 'Black Magician — Material Library'
    cmd.status_bar_text = 'Open Black Magician material library'
    toolbar.add_item(cmd)
    toolbar.show

    file_loaded(File.basename(__FILE__))
  end
end
