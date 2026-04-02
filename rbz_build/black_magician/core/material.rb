require 'fileutils'
require 'tmpdir'

module BlackMagician
  module MaterialManager
    # base64 PNG → SketchUp material
    # final_size_str: final size "WxH" in mm (rotation/grout/mix already applied)
    def self.insert(data_url, vendor, tile_name, final_size_str)
      temp_dir = Dir.tmpdir

      # base64 → 파일
      raw = data_url.sub(/^data:image\/png;base64,/, '')
      bytes = raw.unpack('m')[0]

      mat_name = build_name(vendor, tile_name)
      temp_path = File.join(temp_dir, "bm_#{mat_name}.png")
      File.open(temp_path, 'wb') { |f| f.write(bytes) }

      # 최종 크기 파싱 (이미 회전/줄눈/믹스 반영된 mm)
      dims = parse_size(final_size_str)

      # 머티리얼 등록
      model = Sketchup.active_model
      model.start_operation('Add Material', true)

      materials = model.materials
      final_name = unique_name(materials, mat_name)

      material = materials.add(final_name)
      material.texture = temp_path

      # 텍스처 실제 크기 설정 (mm)
      if dims && material.texture
        material.texture.size = [dims[:w].mm, dims[:h].mm]
      end

      model.commit_operation

      File.delete(temp_path) if File.exist?(temp_path)

      # 페인트 버킷 활성화 + 머티리얼 선택
      Sketchup.send_action("selectPaintTool:")
      model.materials.current = material

      final_name
    end

    private

    def self.build_name(vendor, tile_name)
      "[b]#{vendor}_#{tile_name}"
    end

    def self.unique_name(materials, base)
      return base unless materials[base]
      idx = 2
      loop do
        candidate = "#{base}_#{format('%03d', idx)}"
        return candidate unless materials[candidate]
        idx += 1
      end
    end

    def self.parse_size(size_str)
      parts = size_str.split(/[x×]/).map(&:to_i)
      return nil if parts.length < 2
      { w: parts[0], h: parts[1] }
    end
  end
end
