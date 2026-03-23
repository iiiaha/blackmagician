require_relative 'scanner'
require_relative 'material'

module BlackMagician
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

    @dialog.set_url('https://blackmagician.pages.dev')
    register_callbacks(@dialog)
    @dialog.center
    @dialog.show
  end

  def self.register_callbacks(dialog)
    # 폴더 트리 데이터
    dialog.add_action_callback('scan_deck') do |_ctx|
      data = Scanner.scan
      dialog.execute_script("onDeckData(#{data.to_json})")
    end

    # 크기 폴더 안의 타일 목록 (갤러리용)
    dialog.add_action_callback('get_tiles') do |_ctx, category, vendor, size|
      tiles = Scanner.tiles_in_size(category, vendor, size)
      dialog.execute_script("onTileList(#{tiles.to_json})")
    end

    # 특정 타일의 모든 이미지 (프리뷰/믹스용)
    dialog.add_action_callback('get_tile_images') do |_ctx, category, vendor, size, tile|
      urls = Scanner.image_paths(category, vendor, size, tile)
      dialog.execute_script("onTileImages(#{urls.to_json})")
    end

    # Insert: Canvas 이미지 → SketchUp 머티리얼 등록
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
    menu = UI.menu('Plugins')
    menu.add_item('Black Magician') { show_dialog }
    file_loaded(File.basename(__FILE__))
  end
end
