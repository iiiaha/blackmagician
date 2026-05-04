require 'sketchup'
require 'extensions'

module Younhyun
  PLUGIN_DIR = File.dirname(__FILE__)

  unless file_loaded?(__FILE__)
    ext = SketchupExtension.new(
      'iiiaha_younhyun',
      'younhyun/core/dialog'
    )
    ext.description = 'Browse Younhyun finishing materials, preview with grout/stagger/mix, and apply as SketchUp materials.'
    ext.version     = '1.0.0'
    ext.creator     = 'iiiaha'
    ext.copyright   = '© 2026 iiiaha.lab. All rights reserved.'
    Sketchup.register_extension(ext, true)
    file_loaded(__FILE__)
  end
end
