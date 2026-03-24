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
    @dialog.set_url(LIBRARY_URL)
    @dialog.center
    @dialog.show
  end

  def self.register_callbacks(dialog)
    # Insert: Canvas image → SketchUp material
    dialog.add_action_callback('insert_material') do |_ctx, data_url, vendor, tile_name, size_str|
      begin
        final_name = MaterialManager.insert(data_url, vendor, tile_name, size_str)
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
    icon_path = File.join(PLUGIN_DIR, 'black_magician', 'icons', 'logopic.png')
    toolbar = UI::Toolbar.new('Black Magician')
    cmd = UI::Command.new('Black Magician') { show_dialog }
    cmd.small_icon = icon_path
    cmd.large_icon = icon_path
    cmd.tooltip = 'Black Magician — Material Library'
    cmd.status_bar_text = 'Open Black Magician material library'
    toolbar.add_item(cmd)
    toolbar.show

    file_loaded(File.basename(__FILE__))
  end
end
