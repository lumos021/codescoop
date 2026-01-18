<!DOCTYPE html>
<html>
<head>
    <title><?php echo get_bloginfo('name'); ?></title>
    <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
    <header class="site-header <?php echo get_theme_mod('header_style'); ?>">
        <div class="container">
            <?php if (has_custom_logo()) : ?>
                <?php the_custom_logo(); ?>
            <?php else : ?>
                <h1 class="site-title"><?php bloginfo('name'); ?></h1>
            <?php endif; ?>
            
            <nav class="main-nav" id="primary-menu">
                <?php wp_nav_menu(array('theme_location' => 'primary')); ?>
            </nav>
        </div>
    </header>
    
    <main class="content-area">
        <?php 
        if (have_posts()) :
            while (have_posts()) : the_post();
        ?>
            <article class="post-item post-<?php the_ID(); ?>">
                <h2 class="post-title"><?php the_title(); ?></h2>
                <div class="post-content">
                    <?php the_content(); ?>
                </div>
            </article>
        <?php 
            endwhile;
        endif; 
        ?>
    </main>
    
    <?php wp_footer(); ?>
</body>
</html>
