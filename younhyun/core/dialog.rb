Sketchup.require(File.join(__dir__, 'material'))

module Younhyun
  LIBRARY_URL = 'https://blackmagician.pages.dev?vendor=younhyun'

  def self.show_dialog
    if @dialog && @dialog.visible?
      @dialog.bring_to_front
      return
    end

    @dialog = UI::HtmlDialog.new(
      dialog_title:    'Younhyun Material Library',
      preferences_key: 'YounhyunMaterial',
      width:           900,
      height:          650,
      resizable:       true,
      style:           UI::HtmlDialog::STYLE_DIALOG
    )

    register_callbacks(@dialog)

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
    menu = UI.menu('Plugins')
    menu.add_item('Younhyun Material Library') { show_dialog }

    icon_dir = File.join(PLUGIN_DIR, 'younhyun', 'icons')
    toolbar = UI::Toolbar.new('Younhyun')
    cmd = UI::Command.new('Younhyun Material Library') { show_dialog }
    cmd.small_icon = File.join(icon_dir, 'icon_24.png')
    cmd.large_icon = File.join(icon_dir, 'icon_32.png')
    cmd.tooltip = 'Younhyun Material Library'
    cmd.status_bar_text = 'Open Younhyun Material Library'
    toolbar.add_item(cmd)
    toolbar.show

    file_loaded(File.basename(__FILE__))
  end
end
