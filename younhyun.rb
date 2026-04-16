require 'sketchup'
require 'extensions'

module Younhyun
  PLUGIN_DIR = File.dirname(__FILE__)

  unless file_loaded?(__FILE__)
    ext = SketchupExtension.new(
      'Younhyun Material Library',
      'younhyun/core/dialog'
    )
    ext.description = 'Browse and apply Younhyun finishing materials directly in SketchUp.'
    ext.version     = '1.0.0'
    ext.creator     = 'iiiaha.lab'
    ext.copyright   = '© 2026 윤현상재. All rights reserved.'
    Sketchup.register_extension(ext, true)
    file_loaded(__FILE__)
  end
end
