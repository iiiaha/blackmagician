require 'sketchup'
require 'extensions'

module BlackMagician
  PLUGIN_DIR = File.dirname(__FILE__)

  unless file_loaded?(__FILE__)
    ext = SketchupExtension.new(
      'Black Magician',
      'blackmagician/core/dialog'
    )
    ext.description = 'Browse finishing materials from vendors, preview with grout/stagger/mix options, and apply directly as SketchUp materials.'
    ext.version     = '1.0.0'
    ext.creator     = 'iiiaha.lab'
    ext.copyright   = '© 2026 iiiaha.lab. All rights reserved.'
    Sketchup.register_extension(ext, true)
    file_loaded(__FILE__)
  end
end
