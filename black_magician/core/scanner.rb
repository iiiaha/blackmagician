require 'json'

module BlackMagician
  module Scanner
    DECK_DIR = File.join(PLUGIN_DIR, 'black_magician', 'deck')
    IMAGE_EXT = %w[.jpg .jpeg .png .bmp .tif .tiff].freeze

    # 폴더 트리 (3단계: 대분류 → 벤더 → 크기)
    def self.scan
      return [] unless File.directory?(DECK_DIR)

      categories = []

      sorted_entries(DECK_DIR).each do |cat_name|
        cat_path = File.join(DECK_DIR, cat_name)
        next unless File.directory?(cat_path)

        vendors = []
        sorted_entries(cat_path).each do |vendor_name|
          vendor_path = File.join(cat_path, vendor_name)
          next unless File.directory?(vendor_path)

          sizes = []
          sorted_entries(vendor_path).each do |size_name|
            size_path = File.join(vendor_path, size_name)
            next unless File.directory?(size_path)
            # 크기 폴더 안에 타일 폴더가 하나라도 있으면 표시
            has_tiles = sorted_entries(size_path).any? { |t|
              t_path = File.join(size_path, t)
              File.directory?(t_path) && Dir.entries(t_path).any? { |f| IMAGE_EXT.include?(File.extname(f).downcase) }
            }
            sizes << { 'name' => size_name } if has_tiles
          end

          vendors << { 'name' => vendor_name, 'sizes' => sizes } unless sizes.empty?
        end

        categories << { 'category' => cat_name, 'vendors' => vendors } unless vendors.empty?
      end

      categories
    end

    # 크기 폴더 안의 타일 목록 (갤러리용)
    # 반환: [{ name, count, thumb }]
    def self.tiles_in_size(category, vendor, size)
      size_path = File.join(DECK_DIR, category, vendor, size)
      return [] unless File.directory?(size_path)

      tiles = []
      sorted_entries(size_path).each do |tile_name|
        tile_path = File.join(size_path, tile_name)
        next unless File.directory?(tile_path)

        files = Dir.entries(tile_path).select { |f|
          IMAGE_EXT.include?(File.extname(f).downcase)
        }.sort

        next if files.empty?

        thumb_path = File.join(tile_path, files.first)
        thumb_url = 'file:///' + thumb_path.gsub('\\', '/')

        tiles << {
          'name'  => tile_name,
          'count' => files.length,
          'thumb' => thumb_url
        }
      end

      tiles
    end

    # 특정 타일의 모든 이미지 경로 (프리뷰/믹스용)
    def self.image_paths(category, vendor, size, tile)
      tile_path = File.join(DECK_DIR, category, vendor, size, tile)
      return [] unless File.directory?(tile_path)

      Dir.entries(tile_path).select { |f|
        IMAGE_EXT.include?(File.extname(f).downcase)
      }.sort.map { |f| 'file:///' + File.join(tile_path, f).gsub('\\', '/') }
    end

    private

    def self.sorted_entries(dir)
      Dir.entries(dir).reject { |e| e.start_with?('.') }.sort
    end
  end
end
