require 'sketchup'
require 'extensions'

module Yunhyun
  PLUGIN_DIR = File.dirname(__FILE__)

  unless file_loaded?(__FILE__)
    ext = SketchupExtension.new(
      'Yunhyun Material Library',
      'yunhyun/core/dialog'
    )
    ext.description = 'Browse and apply Yunhyun finishing materials directly in SketchUp.'
    ext.version     = '1.0.0'
    ext.creator     = '윤현상재'
    ext.copyright   = '© 2026 윤현상재. All rights reserved.'
    Sketchup.register_extension(ext, true)
    file_loaded(__FILE__)
  end
end
