require 'fileutils'
require 'tmpdir'
require 'json'

module BlackMagician
  module MaterialManager
    # Insert material from JSON data
    # data keys: albedo, normal, roughness, ao, vendor, tileName, sizeStr, roughnessFactor
    def self.insert(data, pbr_enabled)
      temp_dir = Dir.tmpdir

      # Support legacy call format (plain string args) and new JSON format
      if data.is_a?(String)
        # Legacy: insert(data_url, vendor, tile_name, size_str)
        return insert_legacy(data, pbr_enabled)
      end

      vendor = data['vendor'] || ''
      tile_name = data['tileName'] || ''
      size_str = data['sizeStr'] || ''
      roughness_factor = (data['roughnessFactor'] || 0.5).to_f

      mat_name = build_name(vendor, tile_name)

      # Write albedo
      albedo_path = write_base64(temp_dir, "bm_#{mat_name}_albedo.png", data['albedo'])

      dims = parse_size(size_str)

      # Create material
      model = Sketchup.active_model
      materials = model.materials
      final_name = unique_name(materials, mat_name)

      material = materials.add(final_name)
      material.texture = albedo_path

      if dims && material.texture
        material.texture.size = [dims[:w].mm, dims[:h].mm]
      end

      # PBR maps (SketchUp 2025+)
      if pbr_enabled
        material.metalness_enabled = true
        material.metallic_factor = 0.0
        material.roughness_factor = roughness_factor

        if data['normal']
          normal_path = write_base64(temp_dir, "bm_#{mat_name}_normal.png", data['normal'])
          material.normal_texture = normal_path
          material.normal_scale = 1.0
          File.delete(normal_path) if File.exist?(normal_path)
        end

        if data['roughness']
          rough_path = write_base64(temp_dir, "bm_#{mat_name}_rough.png", data['roughness'])
          material.roughness_texture = rough_path
          File.delete(rough_path) if File.exist?(rough_path)
        end

        if data['ao']
          ao_path = write_base64(temp_dir, "bm_#{mat_name}_ao.png", data['ao'])
          material.ao_texture = ao_path
          File.delete(ao_path) if File.exist?(ao_path)
        end
      end

      File.delete(albedo_path) if File.exist?(albedo_path)

      # Activate paint bucket
      Sketchup.send_action("selectPaintTool:")
      model.materials.current = material

      final_name
    end

    private

    def self.write_base64(dir, filename, data_url)
      raw = data_url.sub(/^data:image\/\w+;base64,/, '')
      bytes = raw.unpack('m')[0]
      path = File.join(dir, filename)
      File.open(path, 'wb') { |f| f.write(bytes) }
      path
    end

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
